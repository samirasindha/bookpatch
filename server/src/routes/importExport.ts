import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "../db/client.js";
import { shelfBooks, shelves, userBooks } from "../db/schema.js";
import { currentUser, requireAuth } from "../lib/auth.js";
import { saveBook } from "../lib/catalog.js";
import { toIsbn13 } from "../lib/isbn.js";
import { getLibrary } from "../lib/library.js";

export const importExportRouter = Router();
importExportRouter.use(requireAuth);

/** A Goodreads export row after the browser has parsed the CSV. */
const ImportRow = z.object({
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().max(300).nullish(),
  isbn: z.string().max(40).nullish(),
  year: z.number().int().nullish(),
  pageCount: z.number().int().min(0).nullish(),
  status: z.enum(["want_to_read", "reading", "finished"]),
  rating: z.number().int().min(1).max(5).nullish(),
  review: z.string().max(20_000).nullish(),
  dateRead: z.string().nullish(),
  owned: z.boolean().default(false),
  shelves: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
});

function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s.replace(/\//g, "-")); // Goodreads uses 2023/05/12
  return Number.isNaN(d.getTime()) ? null : d;
}

importExportRouter.post("/import/goodreads", async (req, res) => {
  const userId = currentUser(req).id;
  const { rows } = z.object({ rows: z.array(ImportRow).max(10_000) }).parse(req.body);

  let imported = 0;
  let skipped = 0;
  const shelfIdByName = new Map<string, string>();

  async function shelfId(name: string) {
    const key = name.toLowerCase();
    if (shelfIdByName.has(key)) return shelfIdByName.get(key)!;
    await db.insert(shelves).values({ userId, name }).onConflictDoNothing();
    const shelf = await db.query.shelves.findFirst({ where: and(eq(shelves.userId, userId), eq(shelves.name, name)) });
    shelfIdByName.set(key, shelf!.id);
    return shelf!.id;
  }

  for (const row of rows) {
    const isbn = toIsbn13(row.isbn);
    // Books without an ISBN get a stable id from their title + author so re-imports don't duplicate them
    const id = isbn
      ? `isbn-${isbn}`
      : `gr-${createHash("sha1").update(`${row.title}|${row.author ?? ""}`.toLowerCase()).digest("hex").slice(0, 16)}`;

    const bookId = await saveBook({
      id,
      title: row.title,
      author: row.author ?? null,
      isbn,
      coverUrl: isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : null,
      description: null,
      publishedYear: row.year ?? null,
      pageCount: row.pageCount ?? null,
    });

    const finishedAt = row.status === "finished" ? (parseDate(row.dateRead) ?? new Date()) : null;
    const [entry] = await db
      .insert(userBooks)
      .values({
        userId,
        bookId,
        status: row.status,
        owned: row.owned,
        rating: row.rating ?? null,
        review: row.review || null,
        totalPages: row.pageCount ?? null,
        progress: row.status === "finished" ? (row.pageCount ?? 0) : 0,
        startedAt: row.status === "want_to_read" ? null : (finishedAt ?? new Date()),
        finishedAt,
      })
      .onConflictDoNothing()
      .returning({ id: userBooks.id });

    if (!entry) {
      skipped++;
      continue;
    }
    imported++;
    for (const name of row.shelves) {
      await db.insert(shelfBooks).values({ shelfId: await shelfId(name), userBookId: entry.id }).onConflictDoNothing();
    }
  }

  res.json({ imported, skipped, shelvesCreated: shelfIdByName.size });
});

importExportRouter.get("/export", async (req, res) => {
  const entries = await getLibrary(currentUser(req).id);
  res.setHeader("Content-Disposition", `attachment; filename="library-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ exportedAt: new Date().toISOString(), entries });
});
