/**
 * Tests for LLM response caching (src/lib/llm-cache.ts).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "crypto";

// Mock the database
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return { from: (...a: unknown[]) => { mockFrom(...a); return { where: (...w: unknown[]) => { mockWhere(...w); return { limit: (...l: unknown[]) => { mockLimit(...l); return Promise.resolve(mockLimit._result ?? []); } }; } }; } };
    },
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return { values: (...v: unknown[]) => { mockValues(...v); return { onConflictDoUpdate: (...o: unknown[]) => { mockOnConflictDoUpdate(...o); return Promise.resolve(); } }; } };
    },
    delete: (...args: unknown[]) => {
      mockDelete(...args);
      return { where: () => Promise.resolve() };
    },
  },
}));

vi.mock("@/db/schema", () => ({
  llmCache: {
    hash: "hash",
    prompt: "prompt",
    response: "response",
    modelUsed: "model_used",
    ttl: "ttl",
    createdAt: "created_at",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import { hashPrompt, getCachedResponse, setCachedResponse } from "@/lib/llm-cache";

beforeEach(() => {
  vi.clearAllMocks();
  (mockLimit as unknown as { _result: unknown[] })._result = [];
});

/* ------------------------------------------------------------------ */
/*  hashPrompt                                                         */
/* ------------------------------------------------------------------ */
describe("hashPrompt", () => {
  it("returns SHA-256 hex hash of the prompt", () => {
    const expected = createHash("sha256").update("test prompt").digest("hex");
    expect(hashPrompt("test prompt")).toBe(expected);
  });

  it("returns consistent hash for same input", () => {
    expect(hashPrompt("hello")).toBe(hashPrompt("hello"));
  });

  it("returns different hashes for different inputs", () => {
    expect(hashPrompt("prompt A")).not.toBe(hashPrompt("prompt B"));
  });

  it("handles empty string", () => {
    const expected = createHash("sha256").update("").digest("hex");
    expect(hashPrompt("")).toBe(expected);
  });
});

/* ------------------------------------------------------------------ */
/*  getCachedResponse                                                  */
/* ------------------------------------------------------------------ */
describe("getCachedResponse", () => {
  it("returns null on cache miss (no rows)", async () => {
    (mockLimit as unknown as { _result: unknown[] })._result = [];
    const result = await getCachedResponse("some prompt");
    expect(result).toBeNull();
  });

  it("returns cached response on cache hit", async () => {
    (mockLimit as unknown as { _result: unknown[] })._result = [
      {
        response: "cached answer",
        modelUsed: "gemini",
        createdAt: new Date(),
        ttl: 86400,
      },
    ];
    const result = await getCachedResponse("some prompt");
    expect(result).toEqual({ response: "cached answer", modelUsed: "gemini" });
  });

  it("returns null and deletes expired entry", async () => {
    const oldDate = new Date(Date.now() - 100_000 * 1000); // 100k seconds ago
    (mockLimit as unknown as { _result: unknown[] })._result = [
      {
        response: "old answer",
        modelUsed: "openai",
        createdAt: oldDate,
        ttl: 86400, // 24h = 86400s < 100000s
      },
    ];
    const result = await getCachedResponse("expired prompt");
    expect(result).toBeNull();
    expect(mockDelete).toHaveBeenCalled();
  });

  it("returns cached response when within TTL", async () => {
    const recentDate = new Date(Date.now() - 3600 * 1000); // 1 hour ago
    (mockLimit as unknown as { _result: unknown[] })._result = [
      {
        response: "recent answer",
        modelUsed: "gemini",
        createdAt: recentDate,
        ttl: 86400,
      },
    ];
    const result = await getCachedResponse("fresh prompt");
    expect(result).toEqual({ response: "recent answer", modelUsed: "gemini" });
  });

  it("returns null on database error", async () => {
    mockSelect.mockImplementationOnce(() => { throw new Error("DB error"); });
    const result = await getCachedResponse("error prompt");
    expect(result).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  setCachedResponse                                                  */
/* ------------------------------------------------------------------ */
describe("setCachedResponse", () => {
  it("inserts a cache entry with default TTL", async () => {
    await setCachedResponse("my prompt", "my response", "gemini");
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: hashPrompt("my prompt"),
        prompt: "my prompt",
        response: "my response",
        modelUsed: "gemini",
        ttl: 86400,
      })
    );
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();
  });

  it("accepts custom TTL", async () => {
    await setCachedResponse("prompt", "response", "openai", 3600);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ ttl: 3600 })
    );
  });

  it("does not throw on database error", async () => {
    mockInsert.mockImplementationOnce(() => { throw new Error("DB error"); });
    await expect(
      setCachedResponse("prompt", "response", "gemini")
    ).resolves.toBeUndefined();
  });
});
