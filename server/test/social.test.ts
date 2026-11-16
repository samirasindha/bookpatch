import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { pool } from "../src/db/client.js";
import { app, resetDb, signedInAgent } from "./helpers.js";

beforeEach(resetDb);
afterAll(() => pool.end());

const book = { id: "gvol1", title: "Jane Eyre", author: "Charlotte Brontë", coverUrl: null, description: null, publishedYear: 1847, isbn: null, pageCount: 500 };

async function friends() {
  const alice = await signedInAgent("Alice");
  const bob = await signedInAgent("Bob");
  await alice.agent.post(`/api/users/${bob.user.handle}/follow`);
  await bob.agent.post(`/api/users/${alice.user.handle}/follow`);
  return { alice, bob };
}

describe("profiles and friends", () => {
  it("following both ways makes two people friends and notifies them", async () => {
    const alice = await signedInAgent("Alice");
    const bob = await signedInAgent("Bob");

    const one = await alice.agent.post(`/api/users/${bob.user.handle}/follow`);
    expect(one.body.relationship).toMatchObject({ following: true, friends: false });

    const two = await bob.agent.post(`/api/users/${alice.user.handle}/follow`);
    expect(two.body.relationship).toMatchObject({ following: true, followedBy: true, friends: true });

    const notes = await bob.agent.get("/api/notifications");
    expect(notes.body.unread).toBe(1);
    expect(notes.body.items[0].type).toBe("new_follower");
  });

  it("respects library privacy: friends-only by default", async () => {
    const alice = await signedInAgent("Alice");
    const stranger = await signedInAgent("Stranger");
    await alice.agent.post("/api/library").send({ book });

    const hidden = await stranger.agent.get(`/api/users/${alice.user.handle}`);
    expect(hidden.body.visible).toBe(false);
    expect(hidden.body.shelf).toBeNull();

    await alice.agent.patch("/api/users/me").send({ libraryVisibility: "public" });
    const shown = await stranger.agent.get(`/api/users/${alice.user.handle}`);
    expect(shown.body.shelf.library).toHaveLength(1);
  });

  it("never exposes another user's email", async () => {
    const { alice, bob } = await friends();
    const res = await alice.agent.get(`/api/users/${bob.user.handle}`);
    expect(res.body.user.email).toBeUndefined();
  });

  it("validates and protects handles", async () => {
    const alice = await signedInAgent("Alice");
    const bob = await signedInAgent("Bob");
    expect((await alice.agent.patch("/api/users/me").send({ handle: "no spaces!" })).status).toBe(400);
    expect((await alice.agent.patch("/api/users/me").send({ handle: bob.user.handle })).status).toBe(400);
    expect((await alice.agent.patch("/api/users/me").send({ handle: "alice_reads" })).body.user.handle).toBe("alice_reads");
  });

  it("finds people by name, but never demo accounts", async () => {
    const alice = await signedInAgent("Alice");
    await signedInAgent("Bobby Tables");
    await request(app).post("/api/auth/demo");
    const res = await alice.agent.get("/api/users/search?q=bob");
    expect(res.body.users.map((u: any) => u.name)).toEqual(["Bobby Tables"]);
    const demo = await alice.agent.get("/api/users/search?q=demo");
    expect(demo.body.users).toHaveLength(0);
  });
});

describe("lending", () => {
  async function ownedEntry(agent: any) {
    const { body } = await agent.post("/api/library").send({ book, owned: true });
    return body.entry.id as string;
  }

  it("lends to a friend on the app, who sees it as borrowed and is notified", async () => {
    const { alice, bob } = await friends();
    const id = await ownedEntry(alice.agent);

    const lent = await alice.agent.post("/api/loans").send({ userBookId: id, borrowerHandle: bob.user.handle, dueDate: "2030-01-01" });
    expect(lent.status).toBe(201);
    expect(lent.body.loan.borrower.handle).toBe(bob.user.handle);

    const bobs = await bob.agent.get("/api/loans");
    expect(bobs.body.borrowed).toHaveLength(1);
    expect((await bob.agent.get("/api/notifications")).body.items.some((n: any) => n.type === "loan_created")).toBe(true);

    const lib = (await alice.agent.get("/api/library")).body.entries;
    expect(lib[0].activeLoan.borrowerName).toBe("Bob");
  });

  it("lends to someone who isn't on the app, by name", async () => {
    const alice = await signedInAgent("Alice");
    const id = await ownedEntry(alice.agent);
    const res = await alice.agent.post("/api/loans").send({ userBookId: id, borrowerName: "Grandma", borrowerEmail: "" });
    expect(res.status).toBe(201);
    expect(res.body.loan.borrower).toBeNull();
  });

  it("won't lend a book you don't own, or one that's already out", async () => {
    const alice = await signedInAgent("Alice");
    const { body } = await alice.agent.post("/api/library").send({ book, owned: false });
    expect((await alice.agent.post("/api/loans").send({ userBookId: body.entry.id, borrowerName: "Sam" })).status).toBe(400);

    await alice.agent.patch(`/api/library/${body.entry.id}`).send({ owned: true });
    expect((await alice.agent.post("/api/loans").send({ userBookId: body.entry.id, borrowerName: "Sam" })).status).toBe(201);
    expect((await alice.agent.post("/api/loans").send({ userBookId: body.entry.id, borrowerName: "Pat" })).status).toBe(409);
  });

  it("won't let you lend someone else's book", async () => {
    const { alice, bob } = await friends();
    const id = await ownedEntry(alice.agent);
    expect((await bob.agent.post("/api/loans").send({ userBookId: id, borrowerName: "Sam" })).status).toBe(404);
  });

  it("nudges once a day, and only the lender can nudge", async () => {
    const { alice, bob } = await friends();
    const id = await ownedEntry(alice.agent);
    const { body } = await alice.agent.post("/api/loans").send({ userBookId: id, borrowerHandle: bob.user.handle });
    const loanId = body.loan.id;

    const first = await alice.agent.post(`/api/loans/${loanId}/nudge`);
    expect(first.body).toEqual({ channel: "in_app", delivered: true });
    expect((await alice.agent.post(`/api/loans/${loanId}/nudge`)).status).toBe(429);
    expect((await bob.agent.post(`/api/loans/${loanId}/nudge`)).status).toBe(403);

    const loans = (await alice.agent.get("/api/loans")).body.lent;
    expect(loans[0].nudgeCount).toBe(1);
  });

  it("either side can mark a book returned, and the other is told", async () => {
    const { alice, bob } = await friends();
    const id = await ownedEntry(alice.agent);
    const { body } = await alice.agent.post("/api/loans").send({ userBookId: id, borrowerHandle: bob.user.handle });

    expect((await bob.agent.patch(`/api/loans/${body.loan.id}/return`)).status).toBe(200);
    const aliceLoans = (await alice.agent.get("/api/loans")).body;
    expect(aliceLoans.lent).toHaveLength(0);
    expect(aliceLoans.history).toHaveLength(1);
    const notes = (await alice.agent.get("/api/notifications")).body.items;
    expect(notes[0].type).toBe("loan_returned");
  });
});

describe("demo cast", () => {
  it("gives demo visitors friends, loans and notifications to explore", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/demo");
    const loans = (await agent.get("/api/loans")).body;
    expect(loans.lent).toHaveLength(2);
    expect(loans.borrowed).toHaveLength(1);
    expect((await agent.get("/api/users/me/friends")).body.people.filter((p: any) => p.friends)).toHaveLength(2);
    expect((await agent.get("/api/users/noorreads")).body.visible).toBe(true);

    // A second visitor reuses the same cast
    const again = request.agent(app);
    await again.post("/api/auth/demo");
    expect((await again.get("/api/loans")).body.borrowed).toHaveLength(1);
  });
});
