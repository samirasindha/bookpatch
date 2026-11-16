/**
 * ISBN helpers. Barcode scanners, Goodreads exports and APIs all format ISBNs differently
 * ("978-0-14-143951-8", "=\"0141439513\"", "0141439513"), so everything is normalized to ISBN-13.
 */

export function cleanIsbn(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9X]/g, "");
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = [...isbn].reduce((acc, ch, i) => acc + (ch === "X" ? 10 : Number(ch)) * (10 - i), 0);
  return sum % 11 === 0;
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false;
  const sum = [...isbn].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return sum % 10 === 0;
}

export function isbn10to13(isbn10: string): string {
  const core = "978" + isbn10.slice(0, 9);
  const sum = [...core].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return core + ((10 - (sum % 10)) % 10);
}

/** Returns a valid ISBN-13, or null if the input isn't a real ISBN. */
export function toIsbn13(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const isbn = cleanIsbn(raw);
  if (isValidIsbn13(isbn)) return isbn;
  if (isValidIsbn10(isbn)) return isbn10to13(isbn);
  return null;
}
