/**
 * Cache strategy definitions for the service worker.
 * Determines how different resource types are cached and served.
 */

export const CACHE_VERSION = "ideate-v2";

export type Strategy = "cache-first" | "network-first" | "stale-while-revalidate" | "network-only";

export interface CacheRule {
  pattern: RegExp;
  strategy: Strategy;
  maxAge: number; // seconds
  cacheName: string;
}

export const CACHE_STRATEGIES: CacheRule[] = [
  // Static assets — cache-first with long TTL
  {
    pattern: /\/_next\/static\//,
    strategy: "cache-first",
    maxAge: 365 * 24 * 3600,
    cacheName: `${CACHE_VERSION}-static`,
  },
  // Icons and images — cache-first
  {
    pattern: /\/(icons|images)\//,
    strategy: "cache-first",
    maxAge: 7 * 24 * 3600,
    cacheName: `${CACHE_VERSION}-assets`,
  },
  // Fonts — cache-first
  {
    pattern: /\/fonts\//,
    strategy: "cache-first",
    maxAge: 365 * 24 * 3600,
    cacheName: `${CACHE_VERSION}-fonts`,
  },
  // API data — network-first (prefer fresh data but serve stale if offline)
  {
    pattern: /\/api\/(projects|proposals|votes|comments)/,
    strategy: "network-first",
    maxAge: 300,
    cacheName: `${CACHE_VERSION}-api`,
  },
  // Search API — network-only (no caching)
  {
    pattern: /\/api\/search/,
    strategy: "network-only",
    maxAge: 0,
    cacheName: `${CACHE_VERSION}-api`,
  },
  // HTML pages — stale-while-revalidate
  {
    pattern: /^\/(?!api\/|_next\/)/,
    strategy: "stale-while-revalidate",
    maxAge: 3600,
    cacheName: `${CACHE_VERSION}-pages`,
  },
];

/**
 * Find the matching cache strategy for a URL pathname.
 */
export function getCacheStrategy(pathname: string): CacheRule | null {
  for (const rule of CACHE_STRATEGIES) {
    if (rule.pattern.test(pathname)) {
      return rule;
    }
  }
  return null;
}
