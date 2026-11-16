/**
 * Parses a Goodreads library export (goodreads_library_export.csv) in the browser.
 * Handles quoted fields with commas and line breaks (reviews often contain both).
 */

export type ImportRow = {
  title: string;
  author: string | null;
  isbn: string | null;
  year: number | null;
  pageCount: number | null;
  status: "want_to_read" | "reading" | "finished";
  rating: number | null;
  review: string | null;
  dateRead: string | null;
  owned: boolean;
  shelves: string[];
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

const BUILT_IN_SHELVES = new Set(["read", "to-read", "currently-reading"]);
const num = (s: string | undefined) => {
  const n = parseInt(s ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function parseGoodreadsExport(text: string): ImportRow[] {
  const [header, ...lines] = parseCsv(text.replace(/^﻿/, ""));
  if (!header) return [];
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const idx = {
    title: col("title"),
    author: col("author"),
    isbn: col("isbn"),
    isbn13: col("isbn13"),
    rating: col("my rating"),
    pages: col("number of pages"),
    year: col("original publication year"),
    yearPublished: col("year published"),
    dateRead: col("date read"),
    shelves: col("bookshelves"),
    exclusive: col("exclusive shelf"),
    review: col("my review"),
    owned: col("owned copies"),
  };
  if (idx.title < 0) throw new Error("This doesn't look like a Goodreads export (no Title column).");

  return lines
    .map((f): ImportRow => {
      const exclusive = (f[idx.exclusive] ?? "").trim();
      const status = exclusive === "read" ? "finished" : exclusive === "currently-reading" ? "reading" : "want_to_read";
      const shelves = (f[idx.shelves] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && !BUILT_IN_SHELVES.has(s));
      const isbn = (f[idx.isbn13] || f[idx.isbn] || "").replace(/[="\s]/g, "") || null;
      return {
        title: (f[idx.title] ?? "").trim(),
        author: (f[idx.author] ?? "").trim() || null,
        isbn,
        year: num(f[idx.year]) ?? num(f[idx.yearPublished]),
        pageCount: num(f[idx.pages]),
        status,
        rating: num(f[idx.rating]),
        review: (f[idx.review] ?? "").replace(/<br\s*\/?>/gi, "\n").trim() || null,
        dateRead: (f[idx.dateRead] ?? "").trim() || null,
        owned: (num(f[idx.owned]) ?? 0) > 0,
        shelves: [...new Set(shelves)],
      };
    })
    .filter((r) => r.title);
}
