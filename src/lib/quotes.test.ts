import { describe, it, expect } from "vitest";
import { QUOTES, quoteForDay } from "./quotes";

describe("the quote list", () => {
  it("attributes every quote", () => {
    for (const quote of QUOTES) {
      expect(quote.attribution.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps every quote short enough to read in a glance", () => {
    for (const quote of QUOTES) {
      expect(quote.text.split(/\s+/).length).toBeLessThanOrEqual(17);
    }
  });

  it("has no duplicates", () => {
    const seen = new Set(QUOTES.map((q) => q.text));
    expect(seen.size).toBe(QUOTES.length);
  });
});

describe("quoteForDay", () => {
  it("returns the same quote all day", () => {
    const morning = quoteForDay(new Date(2026, 7, 26, 6, 30));
    const midnightish = quoteForDay(new Date(2026, 7, 26, 23, 59));
    expect(morning).toEqual(midnightish);
  });

  it("changes the next day", () => {
    const today = quoteForDay(new Date(2026, 7, 26));
    const tomorrow = quoteForDay(new Date(2026, 7, 27));
    expect(today).not.toEqual(tomorrow);
  });

  it("rolls over the month boundary without repeating", () => {
    const last = quoteForDay(new Date(2026, 7, 31));
    const first = quoteForDay(new Date(2026, 8, 1));
    expect(last).not.toEqual(first);
  });

  it("comes back round after a full cycle", () => {
    const start = new Date(2026, 7, 26);
    const later = new Date(2026, 7, 26 + QUOTES.length);
    expect(quoteForDay(start)).toEqual(quoteForDay(later));
  });

  it("returns a real quote for every day of a year", () => {
    for (let i = 0; i < 365; i++) {
      const quote = quoteForDay(new Date(2026, 0, 1 + i));
      expect(QUOTES).toContain(quote);
    }
  });

  it("does not fall off the start of the epoch", () => {
    // A negative day count would index before the array without the guard.
    expect(QUOTES).toContain(quoteForDay(new Date(1969, 0, 1)));
  });
});
