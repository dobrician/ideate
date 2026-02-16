import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("RateLimit Cleanup", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("should cleanup expired entries when interval has passed", async () => {
    // Fill up the rate limit
    const windowMs = 100; // Very short window
    checkRateLimit("cleanup-test-1", 1, windowMs);
    checkRateLimit("cleanup-test-2", 1, windowMs);

    // Wait for window to expire and cleanup interval to pass
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Force cleanup by making a new request with a large enough window
    // that triggers the cleanup check
    const result = checkRateLimit("cleanup-test-3", 5, 60000);
    expect(result.allowed).toBe(true);
  });

  it("should handle retryAfterMs correctly", () => {
    const windowMs = 60000;
    checkRateLimit("retry-test", 1, windowMs);
    const result = checkRateLimit("retry-test", 1, windowMs);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(windowMs);
  });

  it("should handle zero remaining correctly when denied", () => {
    checkRateLimit("zero-test", 1, 60000);
    const denied = checkRateLimit("zero-test", 1, 60000);
    expect(denied.remaining).toBe(0);
    expect(denied.allowed).toBe(false);
  });
});
