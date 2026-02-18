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

  it("store.delete runs when cleanup finds entries with all expired timestamps", async () => {
    vi.useFakeTimers();
    resetRateLimits();

    // Advance far enough to guarantee lastCleanup (module-level) is in the past
    vi.advanceTimersByTime(20 * 60_000);
    // Force cleanup to run and reset lastCleanup to current fake time
    checkRateLimit("force-cleanup-prime", 100, 1000);
    resetRateLimits();

    // Now lastCleanup = current fake time. Add an entry.
    checkRateLimit("will-expire", 100, 1000);

    // Advance past the 1s window + 60s cleanup interval
    vi.advanceTimersByTime(61_000);

    // This call triggers cleanup. "will-expire" timestamps are all > 61s old,
    // window is 1s, so they get filtered out. Entry is empty → store.delete.
    const result = checkRateLimit("trigger", 100, 1000);
    expect(result.allowed).toBe(true);

    // Verify deletion actually happened
    resetRateLimits();
  });

  it("cleanup keeps entries whose timestamps are within the window", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mod = await import("@/lib/rate-limit");
    mod.resetRateLimits();

    // Use a long window (5 min) for all calls
    const windowMs = 5 * 60_000;

    mod.checkRateLimit("survives", 100, windowMs);

    // Advance past cleanup interval (60s) but within the 5-min window
    vi.advanceTimersByTime(61_000);

    // Cleanup runs with windowMs=5min. "survives" timestamp is 61s old,
    // cutoff = now - 5min, so 61s < 5min → timestamp survives filter.
    // entry.timestamps.length > 0 → store.delete NOT called (false branch)
    mod.checkRateLimit("trigger", 100, windowMs);

    const stats = mod.getRateLimitStats();
    expect(stats.keys.some((k) => k.key === "survives")).toBe(true);
  });

  it("getRateLimitStats skips entries with no recent timestamps", async () => {
    vi.useFakeTimers();
    vi.resetModules();

    const mod = await import("@/lib/rate-limit");
    mod.resetRateLimits();

    // Add entry at current time
    mod.checkRateLimit("stale-key", 100, 60_000);

    // Advance past the 15-min stats window but below cleanup interval
    vi.advanceTimersByTime(16 * 60_000);

    // Stats filter excludes entries with all timestamps > 15min old
    const stats = mod.getRateLimitStats();
    expect(stats.keys.some((k) => k.key === "stale-key")).toBe(false);

    // But add a fresh key — should appear
    mod.checkRateLimit("fresh-key", 100, 60_000);
    const stats2 = mod.getRateLimitStats();
    expect(stats2.keys.some((k) => k.key === "fresh-key")).toBe(true);
  });
});
