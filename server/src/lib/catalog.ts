import { eq } from "drizzle-orm";
import { env } from "../env.js";
import { db } from "../db/client.js";
import { books } from "../db/schema.js";
import { toIsbn13 } from "./isbn.js";

/** One normalized shape for a book, whatever source it came from. */
export type CatalogBook = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  description: string | null;
  publishedYear: number | null;
  isbn: string | null;
  pageCount: number | null;
  source: "google" | "openlibrary" | "isbndb" | "cache";
};

type Provider = {
  name: CatalogBook["source"];
  enabled: () => boolean;
  search: (q: string) => Promise<CatalogBook[]>;
  byIsbn: (isbn: string) => Promise<CatalogBook | null>;
};

const TIMEOUT_MS = 6000;

async function getJson(url: string, headers?: Record<string, string>): Promise<any> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return res.json();
}

const yearOf = (d?: string | number | null) => {
  const y = parseInt(String(d ?? ""), 10);
  return Number.isFinite(y) && y > 0 ? y : null;
};
const https = (u?: string | null) => (u ? u.replace(/^http:\/\//, "https://") : null);
const olCover = (isbn: string | null) => (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : null);

/* ---------- Google Books: broadest free catalog ---------- */
function fromGoogle(item: any): CatalogBook {
  const info = item.volumeInfo ?? {};
  const ids: { type: string; identifier: string }[] = info.industryIdentifiers ?? [];
  const isbn = toIsbn13(ids.find((i) => i.type === "ISBN_13")?.identifier ?? ids.find((i) => i.type === "ISBN_10")?.identifier);
  const thumb = https(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail)?.replace("&edge=curl", "");
  return {
    id: item.id,
    title: info.subtitle && info.title.length < 40 ? `${info.title}: ${info.subtitle}` : info.title ?? "Untitled",
    author: info.authors?.join(", ") ?? null,
    coverUrl: thumb ?? olCover(isbn),
    description: info.description ?? null,
    publishedYear: yearOf(info.publishedDate),
    isbn,
    pageCount: info.pageCount ?? null,
    source: "google",
  };
}

const keyParam = () => (env.GOOGLE_BOOKS_API_KEY ? `&key=${env.GOOGLE_BOOKS_API_KEY}` : "");

const google: Provider = {
  name: "google",
  enabled: () => true,
  async search(q) {
    const data = await getJson(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=20&printType=books${keyParam()}`,
    );
    return (data?.items ?? []).map(fromGoogle);
  },
  async byIsbn(isbn) {
    const data = await getJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1${keyParam()}`);
    return data?.items?.[0] ? fromGoogle(data.items[0]) : null;
  },
};

/* ---------- Open Library: free, no key, good covers ---------- */
const openLibrary: Provider = {
  name: "openlibrary",
  enabled: () => true,
  async search(q) {
    const data = await getJson(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=20&fields=key,title,author_name,first_publish_year,isbn,cover_i,number_of_pages_median`,
      { "User-Agent": "BookpatchApp/1.0" },
    );
    return (data?.docs ?? []).map(
      (d: any): CatalogBook => {
        const isbn = toIsbn13((d.isbn ?? []).find((i: string) => toIsbn13(i)));
        return {
          id: `ol-${String(d.key).replace("/works/", "")}`,
          title: d.title,
          author: d.author_name?.join(", ") ?? null,
          coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : olCover(isbn),
          description: null,
          publishedYear: yearOf(d.first_publish_year),
          isbn,
          pageCount: d.number_of_pages_median ?? null,
          source: "openlibrary",
        };
      },
    );
  },
  async byIsbn(isbn) {
    const data = await getJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`, {
      "User-Agent": "BookpatchApp/1.0",
    });
    const b = data?.[`ISBN:${isbn}`];
    if (!b) return null;
    return {
      id: `ol-${isbn}`,
      title: b.subtitle ? `${b.title}: ${b.subtitle}` : b.title,
      author: b.authors?.map((a: any) => a.name).join(", ") ?? null,
      coverUrl: b.cover?.large ?? b.cover?.medium ?? olCover(isbn),
      description: null,
      publishedYear: yearOf(b.publish_date?.match(/\d{4}/)?.[0]),
      isbn,
      pageCount: b.number_of_pages ?? null,
      source: "openlibrary",
    };
  },
};

/* ---------- ISBNdb: optional paid fallback ---------- */
const isbndb: Provider = {
  name: "isbndb",
  enabled: () => Boolean(env.ISBNDB_API_KEY),
  async search() {
    return []; // used for exact ISBN lookups only
  },
  async byIsbn(isbn) {
    const data = await getJson(`https://api2.isbndb.com/book/${isbn}`, { Authorization: env.ISBNDB_API_KEY });
    const b = data?.book;
    if (!b) return null;
    return {
      id: `isbndb-${isbn}`,
      title: b.title_long ?? b.title,
      author: b.authors?.join(", ") ?? null,
      coverUrl: https(b.image) ?? olCover(isbn),
      description: b.synopsis ?? null,
      publishedYear: yearOf(b.date_published),
      isbn,
      pageCount: b.pages ?? null,
      source: "isbndb",
    };
  },
};

export const providers: Provider[] = [google, openLibrary, isbndb];

function dedupe(results: CatalogBook[]): CatalogBook[] {
  const seen = new Set<string>();
  return results.filter((b) => {
    const key = b.isbn ?? `${b.title.toLowerCase()}|${(b.author ?? "").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Search: first provider that answers with results wins; a failing provider falls through to the next. */
export async function searchCatalog(q: string): Promise<CatalogBook[]> {
  for (const p of providers.filter((p) => p.enabled())) {
    try {
      const results = await p.search(q);
      if (results.length) return dedupe(results);
    } catch (err) {
      console.warn(`[catalog] ${p.name} search failed:`, (err as Error).message);
    }
  }
  return [];
}

/** ISBN lookup: our own database first (free, instant), then each provider in order. */
export async function lookupIsbn(rawIsbn: string): Promise<CatalogBook | null> {
  const isbn = toIsbn13(rawIsbn);
  if (!isbn) return null;

  const cached = await db.query.books.findFirst({ where: eq(books.isbn, isbn) });
  if (cached) return { ...cached, source: "cache" };

  for (const p of providers.filter((p) => p.enabled())) {
    try {
      const found = await p.byIsbn(isbn);
      if (found) {
        await saveBook(found);
        return found;
      }
    } catch (err) {
      console.warn(`[catalog] ${p.name} ISBN lookup failed:`, (err as Error).message);
    }
  }
  return null;
}

export type BookInput = Omit<CatalogBook, "source"> & { source?: CatalogBook["source"] };

/**
 * Stores a book in the shared catalog and returns its id. If a book with the same ISBN
 * already exists (maybe from a different source), that record is reused so a user
 * never ends up with two copies of the same edition.
 */
export async function saveBook(book: BookInput): Promise<string> {
  const isbn = toIsbn13(book.isbn);
  if (isbn) {
    const existing = await db.query.books.findFirst({ where: eq(books.isbn, isbn), columns: { id: true } });
    if (existing) return existing.id;
  }
  await db
    .insert(books)
    .values({
      id: book.id,
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl,
      description: book.description,
      publishedYear: book.publishedYear,
      isbn,
      pageCount: book.pageCount,
    })
    .onConflictDoNothing();
  return book.id;
}
