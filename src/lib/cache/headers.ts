/**
 * HTTP cache header utilities for CDN and browser caching.
 * Generates Cache-Control, ETag, and related headers.
 */

import { createHash } from "crypto";

/** Cache policy for different content types. */
export interface CachePolicy {
  /** Cache-Control max-age in seconds. */
  maxAge: number;
  /** Whether to include stale-while-revalidate directive. */
  staleWhileRevalidate?: number;
  /** Whether response is public (CDN-cacheable) or private (browser-only). */
  scope: "public" | "private";
  /** Whether to include must-revalidate directive. */
  mustRevalidate?: boolean;
  /** Whether to include no-store (disables all caching). */
  noStore?: boolean;
}

/** Pre-defined cache policies for common content types. */
export const CACHE_POLICIES: Record<string, CachePolicy> = {
  /** Static assets: JS, CSS, images. Long-lived, CDN-cacheable. */
  static: {
    maxAge: 31536000, // 1 year
    scope: "public",
  },
  /** API responses for public read-only data. Short-lived CDN cache. */
  apiPublic: {
    maxAge: 60,
    staleWhileRevalidate: 300,
    scope: "public",
  },
  /** API responses for authenticated data. Browser-only cache. */
  apiPrivate: {
    maxAge: 60,
    staleWhileRevalidate: 120,
    scope: "private",
  },
  /** HTML pages — short cache with revalidation. */
  page: {
    maxAge: 0,
    staleWhileRevalidate: 60,
    scope: "public",
    mustRevalidate: true,
  },
  /** No caching — mutations, auth endpoints. */
  none: {
    maxAge: 0,
    scope: "private",
    noStore: true,
  },
};

/**
 * Build a Cache-Control header value from a policy.
 */
export function buildCacheControl(policy: CachePolicy): string {
  if (policy.noStore) return "no-store, no-cache";

  const parts: string[] = [policy.scope];
  parts.push(`max-age=${policy.maxAge}`);

  if (policy.staleWhileRevalidate) {
    parts.push(`stale-while-revalidate=${policy.staleWhileRevalidate}`);
  }
  if (policy.mustRevalidate) {
    parts.push("must-revalidate");
  }

  return parts.join(", ");
}

/**
 * Generate a weak ETag from content.
 * Uses MD5 hash truncated to 16 chars for speed.
 */
export function generateETag(content: string): string {
  const hash = createHash("md5").update(content).digest("hex").slice(0, 16);
  return `W/"${hash}"`;
}

/**
 * Check if a conditional request matches the current ETag.
 * Returns true if the client's cached version is still valid (304).
 */
export function isNotModified(
  requestHeaders: { "if-none-match"?: string },
  currentETag: string,
): boolean {
  const ifNoneMatch = requestHeaders["if-none-match"];
  if (!ifNoneMatch) return false;
  return ifNoneMatch === currentETag || ifNoneMatch === `"${currentETag}"`;
}

/**
 * Get appropriate cache headers for an API route.
 * Returns headers object ready to spread into a Response.
 */
export function getCacheHeaders(
  policyName: keyof typeof CACHE_POLICIES,
  etag?: string,
): Record<string, string> {
  const policy = CACHE_POLICIES[policyName];
  if (!policy) return {};

  const headers: Record<string, string> = {
    "Cache-Control": buildCacheControl(policy),
  };

  if (etag) {
    headers["ETag"] = etag;
  }

  // Add Vary header for content negotiation
  headers["Vary"] = "Accept-Encoding, Accept";

  return headers;
}
