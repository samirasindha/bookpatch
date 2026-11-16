import request from "supertest";
import { sql } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";
import { setSessionCookie, SESSION_COOKIE } from "../src/lib/auth.js";
import { users } from "../src/db/schema.js";

export const app = createApp();

let migrated = false;
export async function resetDb() {
  if (!migrated) {
    await runMigrations();
    migrated = true;
  }
  // Wipe all data between tests while keeping the schema
  await db.execute(sql`
    TRUNCATE users, books, user_books, shelves, shelf_books, reading_goals, follows,
             loans, nudges, notifications, clubs, club_members, club_posts
    RESTART IDENTITY CASCADE
  `);
}

/** Creates a user and returns a supertest agent already signed in as them. */
export async function signedInAgent(name = "Test Reader") {
  const handle = name.toLowerCase().replace(/\W/g, "") + Math.floor(Math.random() * 1e6);
  const [user] = await db
    .insert(users)
    .values({ name, handle, email: `${handle}@example.com` })
    .returning();

  // Build a real signed cookie the same way the app does
  let cookie = "";
  setSessionCookie(
    { cookie: (_n: string, value: string) => (cookie = `${SESSION_COOKIE}=${value}`) } as never,
    user.id,
  );
  const agent = request.agent(app);
  agent.set("Cookie", cookie);
  return { agent, user };
}
