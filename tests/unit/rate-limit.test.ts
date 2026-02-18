import { describe, it, expect, beforeEach } from "vitest";
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
});
