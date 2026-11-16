import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { shelfBooks, shelves, userBooks } from "../db/schema.js";
import { badRequest, notFound } from "./errors.js";

export type ReadingStatus = (typeof userBooks.$inferSelect)["status"];

/** Loads a user's library entries with their book and shelf membership. */
export async function getLibrary(userId: string, ids?: string[]) {
  const rows = await db.query.userBooks.findMany({
    where: ids ? and(eq(userBooks.userId, userId), inArray(userBooks.id, ids)) : eq(userBooks.userId, userId),
    with: { book: true, shelfBooks: { columns: { shelfId: true } } },
    orderBy: [desc(userBooks.addedAt)],
  });
  return rows.map(({ shelfBooks: sb, ...entry }) => ({ ...entry, shelfIds: sb.map((s) => s.shelfId) }));
}

export async function getEntry(userId: string, id: string) {
  const [entry] = await getLibrary(userId, [id]);
  if (!entry) throw notFound("Library entry");
  return entry;
}

/**
 * Keeps the reading timeline honest when the status changes:
 * starting a book stamps startedAt, finishing stamps finishedAt (used for goals),
 * and moving a book back out of "finished" clears it.
 */
export function statusTimestamps(
  next: ReadingStatus,
  current: { startedAt: Date | null; finishedAt: Date | null } | null,
  now = new Date(),
) {
  const startedAt = current?.startedAt ?? null;
  const finishedAt = current?.finishedAt ?? null;
  switch (next) {
    case "reading":
      return { startedAt: startedAt ?? now, finishedAt: null };
    case "finished":
      return { startedAt: startedAt ?? now, finishedAt: finishedAt ?? now };
    case "dnf":
      return { startedAt: startedAt ?? now, finishedAt: null };
    default:
      return { startedAt: null, finishedAt: null };
  }
}

/** Replaces the set of shelves an entry is on, after checking the shelves belong to the user. */
export async function setEntryShelves(userId: string, userBookId: string, shelfIds: string[]) {
  const unique = [...new Set(shelfIds)];
  if (unique.length) {
    const owned = await db
      .select({ id: shelves.id })
      .from(shelves)
      .where(and(eq(shelves.userId, userId), inArray(shelves.id, unique)));
    if (owned.length !== unique.length) throw badRequest("One of those shelves doesn't exist");
  }
  await db.transaction(async (tx) => {
    await tx.delete(shelfBooks).where(eq(shelfBooks.userBookId, userBookId));
    if (unique.length) await tx.insert(shelfBooks).values(unique.map((shelfId) => ({ shelfId, userBookId })));
  });
}
