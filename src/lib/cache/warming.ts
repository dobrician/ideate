/**
 * Cache warming for critical paths.
 * Pre-populates cache with frequently accessed data on startup or schedule.
 */

import { cacheSet } from "@/lib/cache";
import { tagCacheKey } from "@/lib/cache/tags";
import { getTTLForEntity } from "@/lib/cache/ttl";
import { logger } from "@/lib/logger";

/** Registered cache warming functions. */
const warmers = new Map<string, () => Promise<string | null>>();

/**
 * Register a cache warmer function.
 * The function should return a JSON string to cache, or null to skip.
 */
export function registerWarmer(
  key: string,
  fn: () => Promise<string | null>,
): void {
  warmers.set(key, fn);
}

/**
 * Run all registered cache warmers.
 * Returns an object with success/failure counts and any errors.
 */
export async function warmCache(): Promise<{
  total: number;
  warmed: number;
  skipped: number;
  errors: string[];
}> {
  const result = { total: warmers.size, warmed: 0, skipped: 0, errors: [] as string[] };

  for (const [key, fn] of warmers) {
    try {
      const value = await fn();
      if (value !== null) {
        const entityType = key.split(":")[0] ?? "moderate";
        const ttl = getTTLForEntity(entityType);
        cacheSet(key, value, ttl);
        tagCacheKey(key, [`warm:${entityType}`]);
        result.warmed++;
      } else {
        result.skipped++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${key}: ${msg}`);
      logger.warn({ key, err: msg }, "Cache warmer failed");
    }
  }

  logger.info(
    { warmed: result.warmed, skipped: result.skipped, errors: result.errors.length },
    "Cache warming complete",
  );
  return result;
}

/**
 * Warm a single specific key.
 * Useful for re-warming after invalidation.
 */
export async function warmKey(key: string): Promise<boolean> {
  const fn = warmers.get(key);
  if (!fn) return false;

  try {
    const value = await fn();
    if (value !== null) {
      const entityType = key.split(":")[0] ?? "moderate";
      cacheSet(key, value, getTTLForEntity(entityType));
      return true;
    }
    return false;
  } catch (err) {
    logger.warn({ key, err: err instanceof Error ? err.message : String(err) }, "Single key warm failed");
    return false;
  }
}

/** Get the list of registered warmer keys. */
export function getRegisteredWarmers(): string[] {
  return Array.from(warmers.keys());
}

/** Clear all registered warmers. */
export function clearWarmers(): void {
  warmers.clear();
}
