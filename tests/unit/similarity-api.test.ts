/**
 * Unit tests for similarity check logic.
 * Tests JSON extraction and Jaccard fallback.
 */

import { describe, it, expect } from "vitest";

// Inline the pure functions for unit testing

function extractJson(text: string): Record<string, { similarity: number; explanation: string }> | null {
  let cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function simpleSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s.toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return Math.round((intersection / union) * 100);
}

describe("extractJson", () => {
  it("should parse clean JSON object", () => {
    const input = '{"p1": {"similarity": 75, "explanation": "Same feature"}}';
    const result = extractJson(input);
    expect(result).not.toBeNull();
    expect(result!["p1"].similarity).toBe(75);
  });

  it("should handle code-fenced JSON", () => {
    const input = '```json\n{"p1": {"similarity": 50, "explanation": "test"}}\n```';
    const result = extractJson(input);
    expect(result).not.toBeNull();
    expect(result!["p1"].similarity).toBe(50);
  });

  it("should extract JSON from surrounding text", () => {
    const input = 'Here is the result: {"p1": {"similarity": 30, "explanation": "low"}} end';
    const result = extractJson(input);
    expect(result).not.toBeNull();
  });

  it("should return null for non-JSON input", () => {
    expect(extractJson("I cannot process this")).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(extractJson("")).toBeNull();
  });

  it("should handle truncated JSON", () => {
    expect(extractJson('{"p1": {"similarity": 50')).toBeNull();
  });
});

describe("simpleSimilarity (Jaccard)", () => {
  it("should return 100 for identical strings", () => {
    expect(simpleSimilarity("hello world test", "hello world test")).toBe(100);
  });

  it("should return 0 for completely different strings", () => {
    const result = simpleSimilarity("alpha beta gamma", "delta epsilon zeta");
    expect(result).toBe(0);
  });

  it("should return a moderate score for partial overlap", () => {
    const result = simpleSimilarity(
      "implement user authentication feature",
      "implement admin authentication system"
    );
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(100);
  });

  it("should return 0 for empty strings", () => {
    expect(simpleSimilarity("", "")).toBe(0);
  });

  it("should return 0 when one string is empty", () => {
    expect(simpleSimilarity("hello world", "")).toBe(0);
  });

  it("should ignore short words (< 3 chars)", () => {
    // "a" and "is" are filtered out, leaving only longer words
    const result = simpleSimilarity("a is the plan", "a is big plan");
    expect(result).toBeGreaterThan(0);
  });

  it("should be case-insensitive", () => {
    expect(simpleSimilarity("Hello World Test", "hello world test")).toBe(100);
  });

  it("should ignore punctuation", () => {
    expect(simpleSimilarity("hello, world! test.", "hello world test")).toBe(100);
  });
});
