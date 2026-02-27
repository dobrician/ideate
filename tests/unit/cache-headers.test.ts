import { describe, it, expect } from "vitest";
import {
  CACHE_POLICIES,
  buildCacheControl,
  generateETag,
  isNotModified,
  getCacheHeaders,
} from "@/lib/cache/headers";

describe("cache/headers", () => {
  describe("CACHE_POLICIES", () => {
    it("defines all expected policies", () => {
      expect(CACHE_POLICIES.static).toBeDefined();
      expect(CACHE_POLICIES.apiPublic).toBeDefined();
      expect(CACHE_POLICIES.apiPrivate).toBeDefined();
      expect(CACHE_POLICIES.page).toBeDefined();
      expect(CACHE_POLICIES.none).toBeDefined();
    });

    it("static policy has 1 year max-age", () => {
      expect(CACHE_POLICIES.static.maxAge).toBe(31536000);
      expect(CACHE_POLICIES.static.scope).toBe("public");
    });

    it("none policy has noStore", () => {
      expect(CACHE_POLICIES.none.noStore).toBe(true);
    });
  });

  describe("buildCacheControl", () => {
    it("builds static cache header", () => {
      const result = buildCacheControl(CACHE_POLICIES.static);
      expect(result).toBe("public, max-age=31536000");
    });

    it("builds no-store cache header", () => {
      const result = buildCacheControl(CACHE_POLICIES.none);
      expect(result).toBe("no-store, no-cache");
    });

    it("includes stale-while-revalidate when specified", () => {
      const result = buildCacheControl(CACHE_POLICIES.apiPublic);
      expect(result).toContain("stale-while-revalidate=300");
    });

    it("includes must-revalidate when specified", () => {
      const result = buildCacheControl(CACHE_POLICIES.page);
      expect(result).toContain("must-revalidate");
    });

    it("uses private scope for private policies", () => {
      const result = buildCacheControl(CACHE_POLICIES.apiPrivate);
      expect(result).toContain("private");
      expect(result).not.toContain("public");
    });

    it("uses public scope for public policies", () => {
      const result = buildCacheControl(CACHE_POLICIES.apiPublic);
      expect(result).toContain("public");
    });
  });

  describe("generateETag", () => {
    it("generates a weak ETag", () => {
      const etag = generateETag("hello");
      expect(etag).toMatch(/^W\/"[a-f0-9]{16}"$/);
    });

    it("generates different ETags for different content", () => {
      const a = generateETag("hello");
      const b = generateETag("world");
      expect(a).not.toBe(b);
    });

    it("generates same ETag for same content", () => {
      const a = generateETag("hello");
      const b = generateETag("hello");
      expect(a).toBe(b);
    });
  });

  describe("isNotModified", () => {
    it("returns true when ETags match", () => {
      const etag = generateETag("hello");
      expect(isNotModified({ "if-none-match": etag }, etag)).toBe(true);
    });

    it("returns false when ETags differ", () => {
      const etag = generateETag("hello");
      const other = generateETag("world");
      expect(isNotModified({ "if-none-match": other }, etag)).toBe(false);
    });

    it("returns false when no if-none-match header", () => {
      const etag = generateETag("hello");
      expect(isNotModified({}, etag)).toBe(false);
    });

    it("handles quoted ETag comparison", () => {
      const etag = 'W/"abc123def456789a"';
      expect(isNotModified({ "if-none-match": etag }, etag)).toBe(true);
    });
  });

  describe("getCacheHeaders", () => {
    it("returns cache headers for a known policy", () => {
      const headers = getCacheHeaders("static");
      expect(headers["Cache-Control"]).toBe("public, max-age=31536000");
      expect(headers["Vary"]).toBe("Accept-Encoding, Accept");
    });

    it("includes ETag when provided", () => {
      const headers = getCacheHeaders("apiPublic", 'W/"abc123"');
      expect(headers["ETag"]).toBe('W/"abc123"');
    });

    it("does not include ETag when not provided", () => {
      const headers = getCacheHeaders("apiPublic");
      expect(headers["ETag"]).toBeUndefined();
    });

    it("returns empty object for unknown policy", () => {
      const headers = getCacheHeaders("nonexistent" as keyof typeof CACHE_POLICIES);
      expect(headers).toEqual({});
    });
  });
});
