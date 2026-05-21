/**
 * Unit tests for AI summarization (src/lib/ai.ts).
 * Mocks the LLM layer (@/lib/llm) so we never hit a real API.
 * LLM-layer tests live in llm.test.ts and llm-logging.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/llm", () => ({
  completeWithFallback: vi.fn(),
}));

import {
  generateSummaryFromText,
  fallbackSummary,
  buildProposalSummary,
} from "@/lib/ai";
import { completeWithFallback } from "@/lib/llm";

const mockedComplete = vi.mocked(completeWithFallback);

// ---------------------------------------------------------------------------
// generateSummaryFromText
// ---------------------------------------------------------------------------

describe("generateSummaryFromText", () => {
  beforeEach(() => {
    mockedComplete.mockReset();
  });

  it("should return null for empty input", async () => {
    const result = await generateSummaryFromText("");
    expect(result).toBeNull();
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("should return null for whitespace-only input", async () => {
    const result = await generateSummaryFromText("   \n\t  ");
    expect(result).toBeNull();
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("should call completeWithFallback and return the text", async () => {
    mockedComplete.mockResolvedValue({
      text: "A concise summary.",
      modelUsed: "anthropic",
    });

    const result = await generateSummaryFromText("Some long description here.");

    expect(mockedComplete).toHaveBeenCalledOnce();
    expect(result).toBe("A concise summary.");
  });

  it("should pass correct LLM options to completeWithFallback", async () => {
    mockedComplete.mockResolvedValue({ text: "ok", modelUsed: "anthropic" });

    await generateSummaryFromText("input", 60, 300);

    const callArgs = mockedComplete.mock.calls[0];
    expect(callArgs[1]).toEqual({
      maxTokens: 180,
      temperature: 0.4,
    });
  });

  it("should include maxWords and maxChars constraints in the prompt", async () => {
    mockedComplete.mockResolvedValue({ text: "ok", modelUsed: "anthropic" });

    await generateSummaryFromText("input", 42, 260);

    const prompt = mockedComplete.mock.calls[0][0];
    expect(prompt).toContain("42 words");
    expect(prompt).toContain("260 characters");
  });

  it("should return null when LLM returns null text", async () => {
    mockedComplete.mockResolvedValue({ text: null, modelUsed: null });

    const result = await generateSummaryFromText("Some text");
    expect(result).toBeNull();
  });

  it("should truncate result to maxChars when provided", async () => {
    const longText = "A".repeat(500);
    mockedComplete.mockResolvedValue({ text: longText, modelUsed: "anthropic" });

    const result = await generateSummaryFromText("input", 60, 100);
    expect(result).toHaveLength(100);
  });

  it("should truncate result to 480 chars when maxChars is not provided", async () => {
    const longText = "B".repeat(600);
    mockedComplete.mockResolvedValue({ text: longText, modelUsed: "anthropic" });

    const result = await generateSummaryFromText("input");
    expect(result).toHaveLength(480);
  });

  it("should return null when completeWithFallback throws", async () => {
    mockedComplete.mockRejectedValue(new Error("network failure"));

    const result = await generateSummaryFromText("input");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fallbackSummary
// ---------------------------------------------------------------------------

describe("fallbackSummary", () => {
  it("should return null for null input", () => {
    expect(fallbackSummary(null)).toBeNull();
  });

  it("should return null for undefined input", () => {
    expect(fallbackSummary(undefined)).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(fallbackSummary("")).toBeNull();
  });

  it("should return null for whitespace-only string", () => {
    expect(fallbackSummary("   ")).toBeNull();
  });

  it("should return trimmed text when shorter than maxChars", () => {
    expect(fallbackSummary("  Hello world  ")).toBe("Hello world");
  });

  it("should return text unchanged when exactly maxChars", () => {
    const text = "A".repeat(240);
    expect(fallbackSummary(text)).toBe(text);
  });

  it("should truncate and add ellipsis when exceeding default maxChars (240)", () => {
    const text = "A".repeat(300);
    const result = fallbackSummary(text);

    expect(result).not.toBeNull();
    expect(result!.endsWith("\u2026")).toBe(true);
    // Total length should be maxChars (239 chars of content + 1 ellipsis = 240)
    expect(result!.length).toBeLessThanOrEqual(240);
  });

  it("should truncate to a custom maxChars limit", () => {
    const text = "A".repeat(100);
    const result = fallbackSummary(text, 50);

    expect(result).not.toBeNull();
    expect(result!.endsWith("\u2026")).toBe(true);
    expect(result!.length).toBeLessThanOrEqual(50);
  });

  it("should trim trailing whitespace before the ellipsis", () => {
    // Build a string where truncation lands in a stretch of spaces
    const text = "Hello" + " ".repeat(240) + "World";
    const result = fallbackSummary(text, 20);

    expect(result).not.toBeNull();
    // trimEnd removes trailing spaces before ellipsis
    expect(result!).not.toMatch(/\s\u2026$/);
    expect(result!.endsWith("\u2026")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildProposalSummary
// ---------------------------------------------------------------------------

describe("buildProposalSummary", () => {
  beforeEach(() => {
    mockedComplete.mockReset();
  });

  it("should return AI-generated summary when LLM succeeds", async () => {
    mockedComplete.mockResolvedValue({
      text: "A proposal to improve onboarding.",
      modelUsed: "anthropic",
    });

    const result = await buildProposalSummary(
      "Better Onboarding",
      "We want to revamp the onboarding flow to reduce drop-off."
    );

    expect(result).toBe("A proposal to improve onboarding.");
    expect(mockedComplete).toHaveBeenCalledOnce();
  });

  it("should include title and description in the prompt sent to LLM", async () => {
    mockedComplete.mockResolvedValue({ text: "summary", modelUsed: "anthropic" });

    await buildProposalSummary("My Title", "My Description");

    const prompt = mockedComplete.mock.calls[0][0];
    expect(prompt).toContain("My Title");
    expect(prompt).toContain("My Description");
  });

  it("should fall back to truncated description when LLM returns null", async () => {
    mockedComplete.mockResolvedValue({ text: null, modelUsed: null });

    const description = "This is a great proposal description.";
    const result = await buildProposalSummary("Title", description);

    expect(result).toBe(description);
  });

  it("should fall back to truncated title when LLM returns null and description is null", async () => {
    mockedComplete.mockResolvedValue({ text: null, modelUsed: null });

    const result = await buildProposalSummary("Awesome Idea", null);

    expect(result).toBe("Awesome Idea");
  });

  it("should fall back to truncated title when LLM returns null and description is undefined", async () => {
    mockedComplete.mockResolvedValue({ text: null, modelUsed: null });

    const result = await buildProposalSummary("Great Plan", undefined);

    expect(result).toBe("Great Plan");
  });

  it("should fall back to truncated title when description is empty string", async () => {
    mockedComplete.mockResolvedValue({ text: null, modelUsed: null });

    const result = await buildProposalSummary("Plan B", "");

    expect(result).toBe("Plan B");
  });

  it("should truncate the AI summary to proposal char limit (260)", async () => {
    const longSummary = "X".repeat(300);
    mockedComplete.mockResolvedValue({ text: longSummary, modelUsed: "anthropic" });

    const result = await buildProposalSummary("Title", "Desc");

    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(260);
  });
});
