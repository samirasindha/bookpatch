import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { userBooks } from "../db/schema.js";
import { currentUser, requireAuth } from "../lib/auth.js";
import { saveBook } from "../lib/catalog.js";
import { getEntry, getLibrary, setEntryShelves, statusTimestamps } from "../lib/library.js";
import { notFound } from "../lib/errors.js";

export const libraryRouter = Router();
libraryRouter.use(requireAuth);

const Status = z.enum(["want_to_read", "reading", "finished", "dnf"]);

export const BookInputSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().max(300).nullable().default(null),
  coverUrl: z.string().url().max(1000).nullable().default(null),
  description: z.string().max(20_000).nullable().default(null),
  publishedYear: z.number().int().min(0).max(3000).nullable().default(null),
  isbn: z.string().max(20).nullable().default(null),
  pageCount: z.number().int().min(0).max(100_000).nullable().default(null),
});

const AddSchema = z.object({
  book: BookInputSchema,
  status: Status.default("want_to_read"),
  owned: z.boolean().default(false),
});

async function addToLibrary(userId: string, input: z.infer<typeof AddSchema>) {
  const bookId = await saveBook(input.book);
  const existing = await db.query.userBooks.findFirst({
    where: and(eq(userBooks.userId, userId), eq(userBooks.bookId, bookId)),
  });
  if (existing) return { id: existing.id, alreadyInLibrary: true };

  const [created] = await db
    .insert(userBooks)
    .values({
      userId,
      bookId,
      status: input.status,
      owned: input.owned,
      totalPages: input.book.pageCount,
      ...statusTimestamps(input.status, null),
    })
    .returning({ id: userBooks.id });
  return { id: created.id, alreadyInLibrary: false };
}

libraryRouter.get("/", async (req, res) => {
  res.json({ entries: await getLibrary(currentUser(req).id) });
});

libraryRouter.get("/stats", async (req, res) => {
  const userId = currentUser(req).id;
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      reading: sql<number>`count(*) filter (where ${userBooks.status} = 'reading')::int`,
      finished: sql<number>`count(*) filter (where ${userBooks.status} = 'finished')::int`,
      wantToRead: sql<number>`count(*) filter (where ${userBooks.status} = 'want_to_read')::int`,
      owned: sql<number>`count(*) filter (where ${userBooks.owned})::int`,
      avgRating: sql<number | null>`round(avg(${userBooks.rating})::numeric, 1)::float`,
    })
    .from(userBooks)
    .where(eq(userBooks.userId, userId));
  res.json(row);
});

libraryRouter.post("/", async (req, res) => {
  const user = currentUser(req);
  const result = await addToLibrary(user.id, AddSchema.parse(req.body));
  res.status(result.alreadyInLibrary ? 200 : 201).json({ ...result, entry: await getEntry(user.id, result.id) });
});

/** Rapid shelving: add many scanned books in one request. */
libraryRouter.post("/bulk", async (req, res) => {
  const user = currentUser(req);
  const { items } = z.object({ items: z.array(AddSchema).min(1).max(200) }).parse(req.body);
  let added = 0;
  for (const item of items) {
    const r = await addToLibrary(user.id, item);
    if (!r.alreadyInLibrary) added++;
  }
  res.json({ added, skipped: items.length - added });
});

const UpdateSchema = z
  .object({
    status: Status,
    owned: z.boolean(),
    progress: z.number().int().min(0).max(100_000),
    totalPages: z.number().int().min(0).max(100_000).nullable(),
    rating: z.number().int().min(1).max(5).nullable(),
    review: z.string().trim().max(10_000).nullable(),
    shelfIds: z.array(z.string().uuid()).max(100),
  })
  .partial();

libraryRouter.patch("/:id", async (req, res) => {
  const user = currentUser(req);
  const body = UpdateSchema.parse(req.body);
  const current = await db.query.userBooks.findFirst({
    where: and(eq(userBooks.id, req.params.id), eq(userBooks.userId, user.id)),
  });
  if (!current) throw notFound("Library entry");

  const { shelfIds, ...fields } = body;
  const updates: Partial<typeof userBooks.$inferInsert> = { ...fields, updatedAt: new Date() };
  if (fields.status && fields.status !== current.status) Object.assign(updates, statusTimestamps(fields.status, current));
  if (fields.status === "finished" && current.totalPages && fields.progress === undefined) updates.progress = current.totalPages;

  await db.update(userBooks).set(updates).where(eq(userBooks.id, current.id));
  if (shelfIds) await setEntryShelves(user.id, current.id, shelfIds);
  res.json({ entry: await getEntry(user.id, current.id) });
});

libraryRouter.delete("/:id", async (req, res) => {
  const user = currentUser(req);
  const deleted = await db
    .delete(userBooks)
    .where(and(eq(userBooks.id, req.params.id), eq(userBooks.userId, user.id)))
    .returning({ id: userBooks.id });
  if (!deleted.length) throw notFound("Library entry");
  res.json({ ok: true });
});
