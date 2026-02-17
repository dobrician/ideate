import { describe, it, expect } from "vitest";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

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
});
