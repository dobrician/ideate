import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit, resetRateLimits, getRateLimitStats } from "@/lib/rate-limit";

describe("RateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("should allow requests under the limit", () => {
    const result = checkRateLimit("test-key", 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("should track remaining correctly", () => {
    checkRateLimit("test-key", 3, 60000);
    checkRateLimit("test-key", 3, 60000);
    const result = checkRateLimit("test-key", 3, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("should deny requests at the limit", () => {
    checkRateLimit("test-key", 2, 60000);
    checkRateLimit("test-key", 2, 60000);
    const result = checkRateLimit("test-key", 2, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("should use different keys independently", () => {
    checkRateLimit("key-a", 1, 60000);
    const result = checkRateLimit("key-b", 1, 60000);
    expect(result.allowed).toBe(true);
  });

  it("should reset correctly", () => {
    checkRateLimit("test-key", 1, 60000);
    checkRateLimit("test-key", 1, 60000);
    expect(checkRateLimit("test-key", 1, 60000).allowed).toBe(false);

    resetRateLimits();
    expect(checkRateLimit("test-key", 1, 60000).allowed).toBe(true);
  });

  it("should allow after window expires", async () => {
    const windowMs = 100; // 100ms window
    checkRateLimit("expire-test", 1, windowMs);
    expect(checkRateLimit("expire-test", 1, windowMs).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(checkRateLimit("expire-test", 1, windowMs).allowed).toBe(true);
  });
});

describe("getRateLimitStats", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("returns empty stats when store is empty", () => {
    const stats = getRateLimitStats();
    expect(stats.totalKeys).toBe(0);
    expect(stats.keys).toEqual([]);
  });

  it("returns active keys with hit counts", () => {
    checkRateLimit("ip:1.2.3.4", 100, 15 * 60_000);
    checkRateLimit("ip:1.2.3.4", 100, 15 * 60_000);
    checkRateLimit("ip:5.6.7.8", 100, 15 * 60_000);
    const stats = getRateLimitStats();
    expect(stats.totalKeys).toBe(2);
    const ip1 = stats.keys.find((k) => k.key === "ip:1.2.3.4");
    expect(ip1?.hitCount).toBe(2);
    const ip2 = stats.keys.find((k) => k.key === "ip:5.6.7.8");
    expect(ip2?.hitCount).toBe(1);
  });

  it("sorts keys by hitCount descending", () => {
    checkRateLimit("low", 100, 60_000);
    checkRateLimit("high", 100, 60_000);
    checkRateLimit("high", 100, 60_000);
    checkRateLimit("high", 100, 60_000);
    const stats = getRateLimitStats();
    expect(stats.keys[0].key).toBe("high");
    expect(stats.keys[1].key).toBe("low");
  });

  it("limits to 50 keys maximum", () => {
    for (let i = 0; i < 60; i++) {
      checkRateLimit(`key-${i}`, 100, 60_000);
    }
    const stats = getRateLimitStats();
    expect(stats.totalKeys).toBe(60);
    expect(stats.keys.length).toBe(50);
  });

  it("excludes entries with all timestamps older than 15 minutes", () => {
    vi.useFakeTimers();
    const base = Date.now();
    // Add an entry at current time
    checkRateLimit("recent-key", 100, 60_000);
    checkRateLimit("old-key", 100, 60_000);

    // Advance time past 15 minutes so old entries are stale
    vi.advanceTimersByTime(16 * 60_000);

    // Add a fresh entry so totalKeys includes recent
    checkRateLimit("fresh-key", 100, 60_000);

    const stats = getRateLimitStats();
    // "recent-key" and "old-key" timestamps are >15min old, excluded
    // "fresh-key" is recent, included
    expect(stats.keys.some((k) => k.key === "fresh-key")).toBe(true);
    expect(stats.keys.some((k) => k.key === "old-key")).toBe(false);
    vi.useRealTimers();
  });
});

describe("RateLimit cleanup deletes empty entries", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes entries with all expired timestamps during cleanup", async () => {
    vi.useFakeTimers();
    vi.resetModules();

    const mod = await import("@/lib/rate-limit");
    mod.resetRateLimits();

    const windowMs = 1000;

    // Add entries
    mod.checkRateLimit("will-expire", 100, windowMs);

    // Advance past the cleanup interval (60s) and the window
    vi.advanceTimersByTime(61_000);

    // Trigger cleanup via a new checkRateLimit call
    mod.checkRateLimit("new-key", 100, windowMs);

    // After cleanup, "will-expire" should have been deleted since its
    // timestamps are older than the window. Verify via stats.
    const stats = mod.getRateLimitStats();
    expect(stats.keys.some((k) => k.key === "will-expire")).toBe(false);
  });
});
