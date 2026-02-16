import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit";

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
