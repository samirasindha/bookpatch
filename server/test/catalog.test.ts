import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pool } from "../src/db/client.js";
import { lookupIsbn, searchCatalog } from "../src/lib/catalog.js";
import { resetDb, signedInAgent } from "./helpers.js";

beforeEach(resetDb);
afterEach(() => vi.restoreAllMocks());
afterAll(() => pool.end());

const googleVolume = {
  id: "gvol1",
  volumeInfo: {
    title: "Middlemarch",
    authors: ["George Eliot"],
    publishedDate: "2003-04-29",
    pageCount: 880,
    industryIdentifiers: [{ type: "ISBN_10", identifier: "0141439548" }],
    imageLinks: { thumbnail: "http://books.google.com/cover.jpg&edge=curl" },
  },
};

function mockFetch(handler: (url: string) => { status?: number; body: unknown }) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const { status = 200, body } = handler(String(input));
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  });
}

describe("book catalog", () => {
  it("normalizes Google Books results (ISBN-13, https cover, year)", async () => {
    mockFetch(() => ({ body: { items: [googleVolume] } }));
    const [book] = await searchCatalog("middlemarch");
    expect(book).toMatchObject({
      id: "gvol1",
      title: "Middlemarch",
      author: "George Eliot",
      isbn: "9780141439549",
      publishedYear: 2003,
      coverUrl: "https://books.google.com/cover.jpg",
      source: "google",
    });
  });

  it("falls back to Open Library when Google fails", async () => {
    mockFetch((url) =>
      url.includes("googleapis")
        ? { status: 503, body: {} }
        : { body: { docs: [{ key: "/works/OL1W", title: "Dracula", author_name: ["Bram Stoker"], first_publish_year: 1897, cover_i: 42 }] } },
    );
    const [book] = await searchCatalog("dracula");
    expect(book.source).toBe("openlibrary");
    expect(book.coverUrl).toBe("https://covers.openlibrary.org/b/id/42-L.jpg");
  });

  it("caches ISBN lookups so the second scan never calls an API", async () => {
    const spy = mockFetch(() => ({ body: { items: [googleVolume] } }));
    const first = await lookupIsbn("0141439548");
    expect(first?.title).toBe("Middlemarch");
    expect(spy).toHaveBeenCalledTimes(1);

    const second = await lookupIsbn("978-0141439549");
    expect(second?.source).toBe("stacks");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid ISBN without calling any API", async () => {
    const spy = mockFetch(() => ({ body: {} }));
    expect(await lookupIsbn("1234567890")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns 404 from the API when no source has the book", async () => {
    mockFetch((url) => (url.includes("googleapis") ? { body: { totalItems: 0 } } : { body: {} }));
    const { agent } = await signedInAgent();
    const res = await agent.get("/api/books/isbn/9780141439549");
    expect(res.status).toBe(404);
  });
});
