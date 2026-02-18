import { describe, it, expect, vi } from "vitest";
import { cn, formatDate, formatDateTime, formatRelativeTime } from "@/lib/utils";

describe("cn utility", () => {
  it("should merge class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("should handle conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("should merge tailwind classes correctly", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("should handle undefined and null", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end");
  });

  it("should handle empty input", () => {
    expect(cn()).toBe("");
  });
});

describe("formatDate", () => {
  const testDate = new Date("2026-02-16T12:00:00Z");

  it("should return empty string for null/undefined", () => {
    expect(formatDate(null, "en")).toBe("");
    expect(formatDate(undefined, "ro")).toBe("");
  });

  it("should format with long style for en locale", () => {
    const result = formatDate(testDate, "en", "long");
    expect(result).toContain("February");
    expect(result).toContain("2026");
    expect(result).toContain("16");
  });

  it("should format with long style for ro locale", () => {
    const result = formatDate(testDate, "ro", "long");
    expect(result.toLowerCase()).toContain("februarie");
    expect(result).toContain("2026");
    expect(result).toContain("16");
  });

  it("should format with short style", () => {
    const result = formatDate(testDate, "en", "short");
    expect(result).toContain("Feb");
    expect(result).toContain("2026");
  });

  it("should use long style by default", () => {
    const result = formatDate(testDate, "en");
    expect(result).toContain("February");
  });
});

describe("formatDateTime", () => {
  it("should return empty string for null/undefined", () => {
    expect(formatDateTime(null, "en")).toBe("");
    expect(formatDateTime(undefined, "ro")).toBe("");
  });

  it("should return a non-empty string for valid date", () => {
    const result = formatDateTime(new Date("2026-02-16T14:30:00Z"), "en");
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("2026");
  });

  it("should format ro locale", () => {
    const result = formatDateTime(new Date("2026-02-16T14:30:00Z"), "ro");
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("2026");
  });
});

describe("formatDate — default style", () => {
  it("uses locale default when style is 'default'", () => {
    const result = formatDate(new Date("2026-03-01T00:00:00Z"), "en", "default");
    expect(result).toContain("2026");
  });

  it("accepts string date input", () => {
    expect(formatDate("2026-01-15", "en")).toContain("January");
  });

  it("accepts numeric timestamp input", () => {
    const ts = new Date("2026-06-01").getTime();
    expect(formatDate(ts, "en", "short")).toContain("Jun");
  });
});

describe("formatRelativeTime", () => {
  const t = vi.fn((key: string, vars?: Record<string, string | number>) => {
    if (vars?.count !== undefined) return `${key}:${vars.count}`;
    return key;
  });

  it("returns empty string for null/undefined", () => {
    expect(formatRelativeTime(null, "en", t)).toBe("");
    expect(formatRelativeTime(undefined, "en", t)).toBe("");
  });

  it("returns '1 minute ago' for just now", () => {
    const justNow = new Date(Date.now() - 10_000); // 10s ago
    const result = formatRelativeTime(justNow, "en", t);
    expect(result).toBe("time.minutesAgo:1");
  });

  it("returns minutes ago for < 60 min", () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60_000);
    const result = formatRelativeTime(thirtyMinAgo, "en", t);
    expect(result).toBe("time.minutesAgo:30");
  });

  it("returns hours ago for < 24 hours", () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 3600_000);
    const result = formatRelativeTime(fiveHoursAgo, "en", t);
    expect(result).toBe("time.hoursAgo:5");
  });

  it("returns days ago for <= 30 days", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400_000);
    const result = formatRelativeTime(tenDaysAgo, "en", t);
    expect(result).toBe("time.daysAgo:10");
  });

  it("returns short date for > 30 days", () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400_000);
    const result = formatRelativeTime(sixtyDaysAgo, "en", t);
    // Should fall back to formatDate short style
    expect(result).toContain("202");
  });

  it("works with string date input", () => {
    const recent = new Date(Date.now() - 120_000).toISOString();
    const result = formatRelativeTime(recent, "ro", t);
    expect(result).toBe("time.minutesAgo:2");
  });

  it("works with numeric timestamp input", () => {
    const ts = Date.now() - 3 * 3600_000;
    const result = formatRelativeTime(ts, "en", t);
    expect(result).toBe("time.hoursAgo:3");
  });

  it("returns 30 days ago at boundary", () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000);
    expect(formatRelativeTime(thirtyDaysAgo, "en", t)).toBe("time.daysAgo:30");
  });

  it("falls back to short date at 31 days", () => {
    const past = new Date(Date.now() - 31 * 86400_000);
    const result = formatRelativeTime(past, "en", t);
    expect(result).not.toContain("time.daysAgo");
    expect(result).toContain("202");
  });

  it("handles ro locale for old dates", () => {
    const past = new Date(Date.now() - 60 * 86400_000);
    const result = formatRelativeTime(past, "ro", t);
    expect(result).toContain("202");
  });
});

describe("formatDate — generic BCP 47 locale support", () => {
  const testDate = new Date("2026-06-15T12:00:00Z");

  it("accepts a full BCP 47 tag like fr-FR", () => {
    const result = formatDate(testDate, "fr-FR", "long");
    expect(result.toLowerCase()).toContain("juin");
    expect(result).toContain("2026");
  });

  it("accepts de locale", () => {
    const result = formatDate(testDate, "de", "long");
    expect(result.toLowerCase()).toContain("juni");
  });

  it("accepts ja-JP locale", () => {
    const result = formatDate(testDate, "ja-JP", "long");
    expect(result).toContain("2026");
  });
});

describe("formatDateTime — generic locale support", () => {
  it("accepts fr-FR locale", () => {
    const result = formatDateTime(new Date("2026-06-15T14:30:00Z"), "fr-FR");
    expect(result).toContain("2026");
  });
});

describe("formatDateTime — edge cases", () => {
  it("accepts string date input", () => {
    const result = formatDateTime("2026-06-15T10:30:00Z", "en");
    expect(result).toContain("2026");
  });

  it("accepts numeric timestamp input", () => {
    const ts = new Date("2026-03-01T08:00:00Z").getTime();
    const result = formatDateTime(ts, "en");
    expect(result).toContain("2026");
  });
});
