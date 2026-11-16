import { and, eq, lt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "./client.js";
import { readingGoals, shelfBooks, shelves, userBooks, users, type User } from "./schema.js";
import { saveBook } from "../lib/catalog.js";
import { toIsbn13 } from "../lib/isbn.js";

type Seed = {
  title: string;
  author: string;
  isbn: string;
  year: number;
  pages: number;
  status: "want_to_read" | "reading" | "finished" | "dnf";
  owned?: boolean;
  progress?: number;
  rating?: number;
  review?: string;
  finishedMonth?: number; // 0-11, in the current year
  shelves?: string[];
};

const SEED: Seed[] = [
  { title: "Middlemarch", author: "George Eliot", isbn: "9780141439549", year: 1871, pages: 880, status: "reading", owned: true, progress: 212, shelves: ["Classics I own"] },
  { title: "Jane Eyre", author: "Charlotte Brontë", isbn: "9780141441146", year: 1847, pages: 624, status: "finished", owned: true, rating: 5, finishedMonth: 1, review: "Reader, I loved it.", shelves: ["Classics I own", "Book club picks"] },
  { title: "Pride and Prejudice", author: "Jane Austen", isbn: "9780141439518", year: 1813, pages: 480, status: "finished", owned: true, rating: 5, finishedMonth: 2, shelves: ["Classics I own"] },
  { title: "Frankenstein", author: "Mary Shelley", isbn: "9780141439471", year: 1818, pages: 352, status: "finished", rating: 4, finishedMonth: 4, review: "Borrowed from the library. Far sadder than I expected.", shelves: ["Book club picks"] },
  { title: "Dracula", author: "Bram Stoker", isbn: "9780141439846", year: 1897, pages: 512, status: "finished", owned: true, rating: 4, finishedMonth: 9, shelves: ["Classics I own"] },
  { title: "Emma", author: "Jane Austen", isbn: "9780141439587", year: 1815, pages: 544, status: "finished", rating: 3, finishedMonth: 6 },
  { title: "Great Expectations", author: "Charles Dickens", isbn: "9780141439563", year: 1861, pages: 544, status: "finished", owned: true, rating: 4, finishedMonth: 7 },
  { title: "Persuasion", author: "Jane Austen", isbn: "9780141439686", year: 1817, pages: 288, status: "want_to_read", owned: true },
  { title: "Wuthering Heights", author: "Emily Brontë", isbn: "9780141439556", year: 1847, pages: 416, status: "want_to_read" },
  { title: "Moby-Dick", author: "Herman Melville", isbn: "9780142437247", year: 1851, pages: 720, status: "want_to_read", owned: true, shelves: ["Classics I own"] },
  { title: "The Odyssey", author: "Homer", isbn: "9780140268867", year: -700, pages: 560, status: "dnf", progress: 140 },
];

async function seedDemoLibrary(user: User) {
  const year = new Date().getUTCFullYear();
  const shelfIds = new Map<string, string>();
  for (const name of ["Classics I own", "Book club picks"]) {
    const [s] = await db.insert(shelves).values({ userId: user.id, name, color: name.startsWith("Book") ? "#2f5d4a" : "#d63a24" }).returning();
    shelfIds.set(name, s.id);
  }

  for (const s of SEED) {
    const isbn = toIsbn13(s.isbn);
    const bookId = await saveBook({
      id: isbn ? `isbn-${isbn}` : `demo-${s.title.toLowerCase().replace(/\W+/g, "-")}`,
      title: s.title,
      author: s.author,
      isbn,
      coverUrl: isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : null,
      description: null,
      publishedYear: s.year > 0 ? s.year : null,
      pageCount: s.pages,
    });
    const finishedAt = s.finishedMonth !== undefined ? new Date(Date.UTC(year, s.finishedMonth, 12)) : null;
    const [entry] = await db
      .insert(userBooks)
      .values({
        userId: user.id,
        bookId,
        status: s.status,
        owned: s.owned ?? false,
        progress: s.status === "finished" ? s.pages : (s.progress ?? 0),
        totalPages: s.pages,
        rating: s.rating ?? null,
        review: s.review ?? null,
        startedAt: s.status === "want_to_read" ? null : (finishedAt ?? new Date()),
        finishedAt,
      })
      .returning({ id: userBooks.id });
    for (const name of s.shelves ?? []) {
      await db.insert(shelfBooks).values({ shelfId: shelfIds.get(name)!, userBookId: entry.id });
    }
  }

  await db.insert(readingGoals).values({ userId: user.id, year, target: 24, period: "year" });
}

/**
 * Every demo visitor gets their own throwaway account with a seeded library,
 * so people trying the live site never see each other's changes.
 * Demo accounts older than a day are cleaned up as new ones are created.
 */
export async function createDemoUser(): Promise<User> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.delete(users).where(and(eq(users.isDemo, true), lt(users.createdAt, yesterday)));

  const tag = randomBytes(4).toString("hex");
  const [user] = await db
    .insert(users)
    .values({
      email: `demo+${tag}@demo.invalid`,
      name: "Demo Reader",
      handle: `demo${tag}`,
      isDemo: true,
      bio: "Just looking around.",
    })
    .returning();
  await seedDemoLibrary(user);
  return user;
}
