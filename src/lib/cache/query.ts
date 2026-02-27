/**
 * Query result caching decorator.
 * Wraps database query functions with automatic caching and invalidation.
 */

import { cacheGet, cacheSet, cacheDelete } from "@/lib/cache";
import { tagCacheKey } from "@/lib/cache/tags";
import { getTTLForEntity } from "@/lib/cache/ttl";
import { logger } from "@/lib/logger";

/**
 * Execute a query with caching. Returns cached result if available,
 * otherwise executes the query and caches the result.
 * @param cacheKey - Unique key for this query result
 * @param entityType - Entity type for TTL determination (e.g., "project", "vote")
 * @param queryFn - The actual query function to execute on cache miss
 * @param tags - Optional tags for grouped invalidation
 */
export function cachedQuery<T>(
  cacheKey: string,
  entityType: string,
  queryFn: () => T,
  tags?: string[],
): T {
  const cached = cacheGet(cacheKey);
  if (cached !== null) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      cacheDelete(cacheKey);
    }
  }

  const result = queryFn();
  const ttl = getTTLForEntity(entityType);

  try {
    cacheSet(cacheKey, JSON.stringify(result), ttl);
    if (tags && tags.length > 0) {
      tagCacheKey(cacheKey, tags);
    }
  } catch (err) {
    logger.warn({ err, cacheKey }, "Failed to cache query result");
  }

  return result;
}

/**
 * Async version of cachedQuery for async database operations.
 */
export async function cachedQueryAsync<T>(
  cacheKey: string,
  entityType: string,
  queryFn: () => Promise<T>,
  tags?: string[],
): Promise<T> {
  const cached = cacheGet(cacheKey);
  if (cached !== null) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      cacheDelete(cacheKey);
    }
  }

  const result = await queryFn();
  const ttl = getTTLForEntity(entityType);

  try {
    cacheSet(cacheKey, JSON.stringify(result), ttl);
    if (tags && tags.length > 0) {
      tagCacheKey(cacheKey, tags);
    }
  } catch (err) {
    logger.warn({ err, cacheKey }, "Failed to cache async query result");
  }

  return result;
}
