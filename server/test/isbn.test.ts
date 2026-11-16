import { describe, expect, it } from "vitest";
import { isValidIsbn10, isValidIsbn13, toIsbn13 } from "../src/lib/isbn.js";

describe("ISBN helpers", () => {
  it("validates ISBN-13 check digits", () => {
    expect(isValidIsbn13("9780141439549")).toBe(true);
    expect(isValidIsbn13("9780141439540")).toBe(false);
  });

  it("validates ISBN-10, including an X check digit", () => {
    expect(isValidIsbn10("0141439513")).toBe(true);
    expect(isValidIsbn10("080442957X")).toBe(true);
    expect(isValidIsbn10("0141439512")).toBe(false);
  });

  it("normalizes every format a scanner or Goodreads produces to ISBN-13", () => {
    expect(toIsbn13("0141439513")).toBe("9780141439518");
    expect(toIsbn13("978-0-14-143951-8")).toBe("9780141439518");
    expect(toIsbn13('="0141439513"')).toBe("9780141439518");
    expect(toIsbn13(" 9780141439518\n")).toBe("9780141439518");
  });

  it("rejects things that are not ISBNs", () => {
    expect(toIsbn13("")).toBeNull();
    expect(toIsbn13(null)).toBeNull();
    expect(toIsbn13("12345")).toBeNull();
    expect(toIsbn13("9780141439540")).toBeNull();
  });
});
