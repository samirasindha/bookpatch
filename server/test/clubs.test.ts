import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { pool } from "../src/db/client.js";
import { app, resetDb, signedInAgent } from "./helpers.js";

beforeEach(resetDb);
afterAll(() => pool.end());

const book = { id: "gvol-mm", title: "Middlemarch", author: "George Eliot", coverUrl: null, description: null, publishedYear: 1871, isbn: null, pageCount: 880 };

async function clubWithBook() {
  const host = await signedInAgent("Host");
  const club = (await host.agent.post("/api/clubs").send({ name: "Classics Night" })).body.club;
  await host.agent.patch(`/api/clubs/${club.id}`).send({ currentBook: book });
  const detail = (await host.agent.get(`/api/clubs/${club.id}`)).body;
  return { host, club, code: detail.club.inviteCode as string };
}

describe("book clubs", () => {
  it("creates a private club whose creator is the host", async () => {
    const { host, club } = await clubWithBook();
    const list = (await host.agent.get("/api/clubs")).body.mine;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Classics Night", myRole: "owner", memberCount: 1, isPrivate: true });
    expect(list[0].inviteCode).toBeUndefined(); // codes never appear in lists
    expect((await host.agent.get(`/api/clubs/${club.id}`)).body.currentBook.title).toBe("Middlemarch");
  });

  it("keeps private clubs private until you join with the invite code", async () => {
    const { club, code } = await clubWithBook();
    const guest = await signedInAgent("Guest");

    expect((await guest.agent.get(`/api/clubs/${club.id}`)).status).toBe(403);
    expect((await guest.agent.post("/api/clubs/join").send({ clubId: club.id })).status).toBe(403);
    expect((await guest.agent.post("/api/clubs/join").send({ code: "wrongcode" })).status).toBe(404);

    expect((await guest.agent.post("/api/clubs/join").send({ code })).status).toBe(200);
    const detail = (await guest.agent.get(`/api/clubs/${club.id}`)).body;
    expect(detail.members).toHaveLength(2);
    expect(detail.club.inviteCode).toBeNull(); // only hosts see the code
  });

  it("lets anyone join a public club", async () => {
    const host = await signedInAgent("Host");
    const club = (await host.agent.post("/api/clubs").send({ name: "Open Shelf", isPrivate: false })).body.club;
    const guest = await signedInAgent("Guest");
    const discover = (await guest.agent.get("/api/clubs")).body.discover;
    expect(discover.map((c: any) => c.name)).toEqual(["Open Shelf"]);
    expect((await guest.agent.post("/api/clubs/join").send({ clubId: club.id })).status).toBe(200);
  });

  it("shows everyone's page in the current book", async () => {
    const { host, club, code } = await clubWithBook();
    const guest = await signedInAgent("Guest");
    await guest.agent.post("/api/clubs/join").send({ code });

    const e = (await guest.agent.post("/api/library").send({ book })).body.entry;
    await guest.agent.patch(`/api/library/${e.id}`).send({ status: "reading", progress: 300 });

    const members = (await host.agent.get(`/api/clubs/${club.id}`)).body.members;
    expect(members.find((m: any) => m.name === "Guest").page).toBe(300);
    expect(members.find((m: any) => m.name === "Host").page).toBeNull();
  });

  it("hides spoilers until you've read that far", async () => {
    const { host, club, code } = await clubWithBook();
    const guest = await signedInAgent("Guest");
    await guest.agent.post("/api/clubs/join").send({ code });
    await host.agent.post(`/api/clubs/${club.id}/posts`).send({ body: "The ending!", spoilerUpToPage: 800 });

    const before = (await guest.agent.get(`/api/clubs/${club.id}`)).body.posts[0];
    expect(before.hiddenAsSpoiler).toBe(true);
    // The author never has their own post hidden
    expect((await host.agent.get(`/api/clubs/${club.id}`)).body.posts[0].hiddenAsSpoiler).toBe(false);

    const e = (await guest.agent.post("/api/library").send({ book })).body.entry;
    await guest.agent.patch(`/api/library/${e.id}`).send({ status: "finished" });
    const after = (await guest.agent.get(`/api/clubs/${club.id}`)).body.posts[0];
    expect(after.hiddenAsSpoiler).toBe(false);
  });

  it("keeps replies one level deep and only lets authors or hosts delete", async () => {
    const { host, club, code } = await clubWithBook();
    const guest = await signedInAgent("Guest");
    const other = await signedInAgent("Other");
    await guest.agent.post("/api/clubs/join").send({ code });
    await other.agent.post("/api/clubs/join").send({ code });

    const top = (await host.agent.post(`/api/clubs/${club.id}/posts`).send({ body: "Thoughts on chapter 1?" })).body.post;
    const reply = (await guest.agent.post(`/api/clubs/${club.id}/posts`).send({ body: "Loved it", parentId: top.id })).body.post;
    const nested = (await other.agent.post(`/api/clubs/${club.id}/posts`).send({ body: "Same", parentId: reply.id })).body.post;
    expect(nested.parentId).toBe(top.id);

    expect((await other.agent.delete(`/api/clubs/${club.id}/posts/${reply.id}`)).status).toBe(403);
    expect((await host.agent.delete(`/api/clubs/${club.id}/posts/${reply.id}`)).status).toBe(200);
  });

  it("only hosts can change the book, and hosts can't abandon a club with members", async () => {
    const { host, club, code } = await clubWithBook();
    const guest = await signedInAgent("Guest");
    await guest.agent.post("/api/clubs/join").send({ code });

    expect((await guest.agent.patch(`/api/clubs/${club.id}`).send({ name: "Mine now" })).status).toBe(403);
    expect((await host.agent.delete(`/api/clubs/${club.id}/members/me`)).status).toBe(400);
    expect((await guest.agent.delete(`/api/clubs/${club.id}/members/me`)).status).toBe(200);
    expect((await host.agent.delete(`/api/clubs/${club.id}/members/me`)).body.deleted).toBe(true);
  });

  it("gives demo visitors a club in progress", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/demo");
    const [club] = (await agent.get("/api/clubs")).body.mine;
    expect(club.name).toBe("Classics Night");
    const detail = (await agent.get(`/api/clubs/${club.id}`)).body;
    expect(detail.members).toHaveLength(3);
    expect(detail.posts.some((p: any) => p.hiddenAsSpoiler)).toBe(true);
  });
});
