import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { pool } from "../src/db/client.js";
import { app, resetDb, signedInAgent } from "./helpers.js";

beforeEach(resetDb);
afterAll(() => pool.end());

const book = (n = 1) => ({
  id: `gvol${n}`,
  title: `Book ${n}`,
  author: "Author",
  coverUrl: null,
  description: null,
  publishedYear: 2001,
  isbn: null,
  pageCount: 300,
});

describe("library", () => {
  it("requires sign-in", async () => {
    const res = await request(app).get("/api/library");
    expect(res.status).toBe(401);
  });

  it("adds a book once, even if added twice", async () => {
    const { agent } = await signedInAgent();
    const first = await agent.post("/api/library").send({ book: book(), status: "want_to_read" });
    expect(first.status).toBe(201);
    const second = await agent.post("/api/library").send({ book: book() });
    expect(second.body.alreadyInLibrary).toBe(true);
    const lib = await agent.get("/api/library");
    expect(lib.body.entries).toHaveLength(1);
  });

  it("treats two sources' copies of the same ISBN as one book", async () => {
    const { agent } = await signedInAgent();
    await agent.post("/api/library").send({ book: { ...book(1), isbn: "0141439513" } });
    const again = await agent.post("/api/library").send({ book: { ...book(2), id: "ol-other", isbn: "9780141439518" } });
    expect(again.body.alreadyInLibrary).toBe(true);
  });

  it("stamps start and finish dates as the status changes", async () => {
    const { agent } = await signedInAgent();
    const { body } = await agent.post("/api/library").send({ book: book() });
    const id = body.entry.id;

    const reading = await agent.patch(`/api/library/${id}`).send({ status: "reading" });
    expect(reading.body.entry.startedAt).toBeTruthy();
    expect(reading.body.entry.finishedAt).toBeNull();

    const finished = await agent.patch(`/api/library/${id}`).send({ status: "finished", rating: 5 });
    expect(finished.body.entry.finishedAt).toBeTruthy();
    expect(finished.body.entry.progress).toBe(300);
    expect(finished.body.entry.rating).toBe(5);

    const back = await agent.patch(`/api/library/${id}`).send({ status: "reading" });
    expect(back.body.entry.finishedAt).toBeNull();
  });

  it("never lets one user touch another user's books", async () => {
    const alice = await signedInAgent("Alice");
    const bob = await signedInAgent("Bob");
    const { body } = await alice.agent.post("/api/library").send({ book: book() });

    expect((await bob.agent.patch(`/api/library/${body.entry.id}`).send({ rating: 1 })).status).toBe(404);
    expect((await bob.agent.delete(`/api/library/${body.entry.id}`)).status).toBe(404);
    expect((await bob.agent.get("/api/library")).body.entries).toHaveLength(0);
  });

  it("validates input", async () => {
    const { agent } = await signedInAgent();
    const res = await agent.post("/api/library").send({ book: { ...book(), title: "" } });
    expect(res.status).toBe(400);
  });

  it("adds many scanned books at once", async () => {
    const { agent } = await signedInAgent();
    const res = await agent.post("/api/library/bulk").send({
      items: [{ book: book(1), owned: true }, { book: book(2), owned: true }, { book: book(1), owned: true }],
    });
    expect(res.body).toEqual({ added: 2, skipped: 1 });
  });
});

describe("shelves", () => {
  it("puts books on custom shelves and counts them", async () => {
    const { agent } = await signedInAgent();
    const shelf = (await agent.post("/api/shelves").send({ name: "Beach Reads" })).body.shelf;
    const entry = (await agent.post("/api/library").send({ book: book() })).body.entry;

    const updated = await agent.patch(`/api/library/${entry.id}`).send({ shelfIds: [shelf.id] });
    expect(updated.body.entry.shelfIds).toEqual([shelf.id]);

    const list = await agent.get("/api/shelves");
    expect(list.body.shelves[0]).toMatchObject({ name: "Beach Reads", bookCount: 1 });
  });

  it("rejects duplicate shelf names and other users' shelves", async () => {
    const alice = await signedInAgent("Alice");
    const bob = await signedInAgent("Bob");
    const shelf = (await alice.agent.post("/api/shelves").send({ name: "Faves" })).body.shelf;
    expect((await alice.agent.post("/api/shelves").send({ name: "Faves" })).status).toBe(400);

    const bobEntry = (await bob.agent.post("/api/library").send({ book: book() })).body.entry;
    const res = await bob.agent.patch(`/api/library/${bobEntry.id}`).send({ shelfIds: [shelf.id] });
    expect(res.status).toBe(400);
  });
});

describe("goals", () => {
  it("counts books finished this year toward the goal", async () => {
    const { agent } = await signedInAgent();
    await agent.put("/api/goals").send({ target: 10, period: "year" });
    for (const n of [1, 2, 3]) {
      const e = (await agent.post("/api/library").send({ book: book(n) })).body.entry;
      await agent.patch(`/api/library/${e.id}`).send({ status: "finished" });
    }
    const res = await agent.get("/api/goals");
    expect(res.body.goal).toEqual({ target: 10, period: "year" });
    expect(res.body.progress.finished).toBe(3);
    expect(res.body.progress.remaining).toBe(7);
    expect(res.body.monthly[new Date().getUTCMonth()].count).toBe(3);
  });
});

describe("Goodreads import", () => {
  it("imports books, ratings, read dates and custom shelves without duplicating on re-import", async () => {
    const { agent } = await signedInAgent();
    const rows = [
      { title: "Jane Eyre", author: "Charlotte Brontë", isbn: '="0141441143"', status: "finished", rating: 5, dateRead: "2024/03/02", owned: true, shelves: ["classics"] },
      { title: "No ISBN Book", author: "Someone", status: "want_to_read", shelves: ["classics", "someday"] },
    ];
    const first = await agent.post("/api/library/import/goodreads").send({ rows });
    expect(first.body).toEqual({ imported: 2, skipped: 0, shelvesCreated: 2 });

    const again = await agent.post("/api/library/import/goodreads").send({ rows });
    expect(again.body.imported).toBe(0);

    const lib = (await agent.get("/api/library")).body.entries;
    const jane = lib.find((e: any) => e.book.title === "Jane Eyre");
    expect(jane).toMatchObject({ status: "finished", rating: 5, owned: true });
    expect(jane.book.isbn).toBe("9780141441146");
    expect(jane.finishedAt.slice(0, 10)).toBe("2024-03-02");
  });
});

describe("demo accounts", () => {
  it("gives each visitor their own seeded library", async () => {
    const a = request.agent(app);
    const b = request.agent(app);
    await a.post("/api/auth/demo");
    await b.post("/api/auth/demo");

    const libA = (await a.get("/api/library")).body.entries;
    expect(libA.length).toBeGreaterThan(5);
    await a.delete(`/api/library/${libA[0].id}`);

    const libB = (await b.get("/api/library")).body.entries;
    expect(libB.length).toBe(libA.length);
    expect((await a.get("/api/goals")).body.goal.target).toBe(24);
  });
});
