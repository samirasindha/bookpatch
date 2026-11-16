import { Router } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { shelfBooks, shelves } from "../db/schema.js";
import { currentUser, requireAuth } from "../lib/auth.js";
import { badRequest, notFound } from "../lib/errors.js";

export const shelvesRouter = Router();
shelvesRouter.use(requireAuth);

const ShelfSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

shelvesRouter.get("/", async (req, res) => {
  const rows = await db
    .select({
      id: shelves.id,
      name: shelves.name,
      color: shelves.color,
      bookCount: sql<number>`(select count(*)::int from ${shelfBooks} where ${shelfBooks.shelfId} = ${shelves.id})`,
    })
    .from(shelves)
    .where(eq(shelves.userId, currentUser(req).id))
    .orderBy(asc(shelves.createdAt));
  res.json({ shelves: rows });
});

shelvesRouter.post("/", async (req, res) => {
  const user = currentUser(req);
  const body = ShelfSchema.parse(req.body);
  const [shelf] = await db
    .insert(shelves)
    .values({ userId: user.id, ...body })
    .onConflictDoNothing()
    .returning();
  if (!shelf) throw badRequest(`You already have a shelf called "${body.name}"`);
  res.status(201).json({ shelf: { ...shelf, bookCount: 0 } });
});

shelvesRouter.patch("/:id", async (req, res) => {
  const body = ShelfSchema.partial().parse(req.body);
  const [shelf] = await db
    .update(shelves)
    .set(body)
    .where(and(eq(shelves.id, req.params.id), eq(shelves.userId, currentUser(req).id)))
    .returning();
  if (!shelf) throw notFound("Shelf");
  res.json({ shelf });
});

shelvesRouter.delete("/:id", async (req, res) => {
  const deleted = await db
    .delete(shelves)
    .where(and(eq(shelves.id, req.params.id), eq(shelves.userId, currentUser(req).id)))
    .returning({ id: shelves.id });
  if (!deleted.length) throw notFound("Shelf");
  res.json({ ok: true });
});
