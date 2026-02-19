import { cacheGet, cacheSet } from "@/lib/cache";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Wrap an async data-fetching function with cache.
 * Returns cached JSON string if available, otherwise calls fn and caches result.
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl = 300,
): Promise<T> {
  const cached = cacheGet(key);
  if (cached !== null) {
    return JSON.parse(cached) as T;
  }
  const result = await fn();
  cacheSet(key, JSON.stringify(result), ttl);
  return result;
}

/**
 * Cache middleware for API route handlers.
 * Wraps a route handler to check cache before executing.
 */
export function cachedRoute(
  handler: (req: NextRequest) => Promise<NextResponse>,
  opts: { keyFn: (req: NextRequest) => string; ttl?: number },
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    if (req.method !== "GET") {
      return handler(req);
    }
    const key = opts.keyFn(req);
    const cached = cacheGet(key);
    if (cached !== null) {
      return NextResponse.json(JSON.parse(cached), {
        headers: { "x-cache": "HIT" },
      });
    }
    const response = await handler(req);
    if (response.ok) {
      try {
        const body = await response.clone().text();
        cacheSet(key, body, opts.ttl ?? 300);
      } catch {
        // Non-JSON or stream response — skip caching
      }
    }
    return new NextResponse(response.body, {
      status: response.status,
      headers: { ...Object.fromEntries(response.headers), "x-cache": "MISS" },
    });
  };
}
