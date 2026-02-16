/**
 * Unit tests for the AI suggestions tryParseSuggestions logic.
 * Tests the JSON extraction from various LLM output formats.
 */

import { describe, it, expect } from "vitest";

// Inline the function for pure unit testing (no API route deps)
function tryParseSuggestions(raw: string) {
  let cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!arrMatch) return [];

  try {
    const parsed = JSON.parse(arrMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item: unknown): item is { title: string; details: string; summary: string } =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as { title: unknown }).title === "string" &&
          typeof (item as { details: unknown }).details === "string" &&
          typeof (item as { summary: unknown }).summary === "string"
      )
      .slice(0, 3)
      .map((s) => ({
        title: s.title.slice(0, 200),
        details: s.details,
        summary: s.summary.slice(0, 240),
      }));
  } catch {
    return [];
  }
}

describe("tryParseSuggestions", () => {
  it("should parse clean JSON array", () => {
    const input = '[{"title":"A","details":"B","summary":"C"}]';
    const result = tryParseSuggestions(input);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("A");
  });

  it("should handle code-fenced JSON", () => {
    const input = '```json\n[{"title":"A","details":"B","summary":"C"}]\n```';
    const result = tryParseSuggestions(input);
    expect(result).toHaveLength(1);
  });

  it("should handle extra text around JSON", () => {
    const input = 'Here are my suggestions:\n[{"title":"A","details":"B","summary":"C"}]\nHope this helps!';
    const result = tryParseSuggestions(input);
    expect(result).toHaveLength(1);
  });

  it("should limit to 3 suggestions", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      title: `T${i}`,
      details: `D${i}`,
      summary: `S${i}`,
    }));
    const result = tryParseSuggestions(JSON.stringify(items));
    expect(result).toHaveLength(3);
  });

  it("should truncate title to 200 chars", () => {
    const input = JSON.stringify([{
      title: "A".repeat(300),
      details: "details",
      summary: "summary",
    }]);
    const result = tryParseSuggestions(input);
    expect(result[0].title).toHaveLength(200);
  });

  it("should truncate summary to 240 chars", () => {
    const input = JSON.stringify([{
      title: "title",
      details: "details",
      summary: "S".repeat(300),
    }]);
    const result = tryParseSuggestions(input);
    expect(result[0].summary).toHaveLength(240);
  });

  it("should return empty array for non-JSON input", () => {
    expect(tryParseSuggestions("I can't generate suggestions.")).toEqual([]);
  });

  it("should return empty array for empty string", () => {
    expect(tryParseSuggestions("")).toEqual([]);
  });

  it("should filter out objects missing required fields", () => {
    const input = JSON.stringify([
      { title: "A", details: "B", summary: "C" },
      { title: "D", details: "E" }, // missing summary
      { title: "F" }, // missing details and summary
    ]);
    const result = tryParseSuggestions(input);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("A");
  });

  it("should handle malformed JSON gracefully", () => {
    expect(tryParseSuggestions("[{invalid json")).toEqual([]);
  });
});
