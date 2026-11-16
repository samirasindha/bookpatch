import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetDb, signedInAgent } from "./helpers.js";
import { pool } from "../src/db/client.js";

beforeEach(resetDb);
afterAll(() => pool.end());

describe("auth", () => {
  it("reports health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("returns no user when signed out", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.body.user).toBeNull();
  });

  it("signs in to the demo account and keeps the session", async () => {
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/demo");
    expect(login.status).toBe(200);
    expect(login.headers["set-cookie"]?.[0]).toMatch(/httpOnly/i);

    const me = await agent.get("/api/auth/me");
    expect(me.body.user.name).toBe("Demo Reader");
    expect(me.body.user.isDemo).toBe(true);
  });

  it("logs out", async () => {
    const { agent } = await signedInAgent();
    await agent.post("/api/auth/logout");
    const me = await request(app).get("/api/auth/me");
    expect(me.body.user).toBeNull();
  });

  it("rejects Google sign-in when it is not configured", async () => {
    const res = await request(app).post("/api/auth/google").send({ credential: "x".repeat(20) });
    expect(res.status).toBe(503);
  });

  it("rejects a forged session cookie", async () => {
    const res = await request(app).get("/api/auth/me").set("Cookie", "stacks_session=not-a-real-token");
    expect(res.body.user).toBeNull();
  });
});
