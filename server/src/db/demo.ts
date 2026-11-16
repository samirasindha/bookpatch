import { and, eq, like, lt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "./client.js";
import { follows, loans, notifications, readingGoals, shelfBooks, shelves, userBooks, users, type User } from "./schema.js";
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

/* ---------- The demo cast: a few shared friends so social features have something to show ---------- */
type CastMember = { handle: string; name: string; bio: string; books: { title: string; author: string; status: Seed["status"]; rating?: number; review?: string; owned?: boolean; pages: number; progress?: number }[] };

const CAST: CastMember[] = [
  {
    handle: "noorreads",
    name: "Noor Haddad",
    bio: "Slow reader, fast annotator. Always halfway through a Russian novel.",
    books: [
      { title: "Anna Karenina", author: "Leo Tolstoy", status: "reading", pages: 864, progress: 402, owned: true },
      { title: "Persuasion", author: "Jane Austen", status: "finished", rating: 5, review: "Captain Wentworth's letter. That's the review.", pages: 288, owned: true },
      { title: "The Secret Garden", author: "Frances Hodgson Burnett", status: "finished", rating: 4, pages: 336, owned: true },
    ],
  },
  {
    handle: "mayachen",
    name: "Maya Chen",
    bio: "Book club host. Will lend you anything if you promise to talk about it.",
    books: [
      { title: "Little Women", author: "Louisa May Alcott", status: "reading", pages: 759, progress: 120, owned: true },
      { title: "Frankenstein", author: "Mary Shelley", status: "finished", rating: 5, pages: 352, owned: true },
    ],
  },
  {
    handle: "theobrooks",
    name: "Theo Brooks",
    bio: "Mostly mysteries. Occasionally poetry when nobody's watching.",
    books: [
      { title: "The Hound of the Baskervilles", author: "Arthur Conan Doyle", status: "finished", rating: 4, pages: 256, owned: true },
      { title: "Leaves of Grass", author: "Walt Whitman", status: "want_to_read", pages: 512 },
    ],
  },
];

async function bookFor(title: string, author: string, pages: number) {
  return saveBook({
    id: `demo-${title.toLowerCase().replace(/\W+/g, "-")}`,
    title,
    author,
    isbn: null,
    coverUrl: null,
    description: null,
    publishedYear: null,
    pageCount: pages,
  });
}

/** Creates the shared cast once; they're demo accounts, hidden from real users' searches. */
async function ensureCast() {
  const out: Record<string, { user: User; entries: Record<string, string> }> = {};
  for (const m of CAST) {
    let user = await db.query.users.findFirst({ where: eq(users.handle, m.handle) });
    const entries: Record<string, string> = {};
    if (!user) {
      [user] = await db
        .insert(users)
        .values({ email: `cast-${m.handle}@demo.invalid`, name: m.name, handle: m.handle, bio: m.bio, isDemo: true, libraryVisibility: "public" })
        .returning();
      for (const b of m.books) {
        const bookId = await bookFor(b.title, b.author, b.pages);
        const finishedAt = b.status === "finished" ? new Date(Date.now() - Math.random() * 90 * 86400_000) : null;
        await db.insert(userBooks).values({
          userId: user.id,
          bookId,
          status: b.status,
          owned: b.owned ?? false,
          totalPages: b.pages,
          progress: b.status === "finished" ? b.pages : (b.progress ?? 0),
          rating: b.rating ?? null,
          review: b.review ?? null,
          startedAt: b.status === "want_to_read" ? null : new Date(Date.now() - 120 * 86400_000),
          finishedAt,
        });
      }
    }
    for (const row of await db.query.userBooks.findMany({ where: eq(userBooks.userId, user.id), with: { book: true } })) {
      entries[row.book.title] = row.id;
    }
    out[m.handle] = { user, entries };
  }
  return out;
}

async function seedDemoSocial(visitor: User) {
  const cast = await ensureCast();
  const noor = cast.noorreads.user;
  const maya = cast.mayachen.user;
  const theo = cast.theobrooks.user;

  // Noor and Maya are friends (mutual follows); Theo follows the visitor
  await db.insert(follows).values([
    { followerId: visitor.id, followingId: noor.id },
    { followerId: noor.id, followingId: visitor.id },
    { followerId: visitor.id, followingId: maya.id },
    { followerId: maya.id, followingId: visitor.id },
    { followerId: theo.id, followingId: visitor.id },
  ]);

  const mine = await db.query.userBooks.findMany({ where: eq(userBooks.userId, visitor.id), with: { book: true } });
  const entry = (title: string) => mine.find((e) => e.book.title === title)!;
  const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000);
  const dateIn = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);

  // Lent out: Jane Eyre to Maya (overdue), Dracula to a friend who isn't on the app
  await db.insert(loans).values([
    { userBookId: entry("Jane Eyre").id, lenderId: visitor.id, borrowerId: maya.id, borrowerName: maya.name, loanedAt: daysAgo(34), dueDate: dateIn(-4), notes: "Dog-eared at chapter 27. Sorry!" },
    { userBookId: entry("Dracula").id, lenderId: visitor.id, borrowerName: "Sam", loanedAt: daysAgo(9), dueDate: dateIn(21) },
  ]);
  // Borrowed: Noor lent the visitor The Secret Garden
  await db.insert(loans).values({
    userBookId: cast.noorreads.entries["The Secret Garden"],
    lenderId: noor.id,
    borrowerId: visitor.id,
    borrowerName: visitor.name,
    loanedAt: daysAgo(6),
    dueDate: dateIn(24),
  });

  const who = (u: User) => ({ id: u.id, name: u.name, handle: u.handle, avatarUrl: null, bio: u.bio });
  await db.insert(notifications).values([
    { userId: visitor.id, type: "new_follower", payload: JSON.stringify({ from: who(theo) }), createdAt: daysAgo(1) },
    { userId: visitor.id, type: "loan_created", payload: JSON.stringify({ from: who(noor), title: "The Secret Garden", dueDate: dateIn(24) }), createdAt: daysAgo(6) },
  ]);
}

/**
 * Every demo visitor gets their own throwaway account with a seeded library,
 * so people trying the live site never see each other's changes.
 * Demo accounts older than a day are cleaned up as new ones are created.
 */
export async function createDemoUser(): Promise<User> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  // Only visitor accounts expire; the shared demo cast stays
  await db.delete(users).where(and(eq(users.isDemo, true), like(users.email, "demo+%"), lt(users.createdAt, yesterday)));

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
  await seedDemoSocial(user);
  return user;
}
