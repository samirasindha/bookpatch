import { eq, or } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, type User } from "../db/schema.js";

export function slugifyHandle(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
  return base || "reader";
}

async function uniqueHandle(seed: string): Promise<string> {
  const base = slugifyHandle(seed);
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    const taken = await db.query.users.findFirst({ where: eq(users.handle, candidate), columns: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}${Date.now().toString(36)}`;
}

/** Finds a user by Google id or email, creating one on first sign-in. */
export async function upsertGoogleUser(profile: {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}): Promise<User> {
  const existing = await db.query.users.findFirst({
    where: or(eq(users.googleId, profile.googleId), eq(users.email, profile.email)),
  });

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({ googleId: profile.googleId, avatarUrl: profile.avatarUrl ?? existing.avatarUrl })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl ?? null,
      handle: await uniqueHandle(profile.name || profile.email.split("@")[0]),
    })
    .returning();
  return created;
}

/** The fields that are safe to send to other users. */
export function publicUser(u: User) {
  return { id: u.id, name: u.name, handle: u.handle, avatarUrl: u.avatarUrl, bio: u.bio };
}

export function selfUser(u: User) {
  return { ...publicUser(u), email: u.email, libraryVisibility: u.libraryVisibility, isDemo: u.isDemo };
}
