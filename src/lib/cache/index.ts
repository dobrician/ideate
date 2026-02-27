import { db } from "@/db";
import { cacheEntries } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { getRedis, isRedisReady } from "@/lib/redis";

// ─── In-memory layer (L1) ───────────────────────────────────────────

interface MemEntry {
  value: string;
  expiresAt: number;
}

const memStore = new Map<string, MemEntry>();
const MAX_MEM_ENTRIES = 500;

function memGet(key: string): string | null {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (Date.now() / 1000 > entry.expiresAt) {
    memStore.delete(key);
    return null;
  }
  return entry.value;
}

function memSet(key: string, value: string, ttl: number): void {
  if (memStore.size >= MAX_MEM_ENTRIES) {
    const firstKey = memStore.keys().next().value;
    if (firstKey !== undefined) memStore.delete(firstKey);
  }
  memStore.set(key, { value, expiresAt: Math.floor(Date.now() / 1000) + ttl });
}

function memDelete(key: string): void {
  memStore.delete(key);
}

// ─── Redis layer (L2) ──────────────────────────────────────────────

const REDIS_PREFIX = "cache:";

async function redisGet(key: string): Promise<string | null> {
  if (!isRedisReady()) return null;
  try {
    const redis = getRedis();
    if (!redis) return null;
    return await redis.get(REDIS_PREFIX + key);
  } catch (err) {
    logger.warn({ err, key }, "Redis cache get failed");
    return null;
  }
}

async function redisSet(key: string, value: string, ttl: number): Promise<void> {
  if (!isRedisReady()) return;
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.set(REDIS_PREFIX + key, value, "EX", ttl);
  } catch (err) {
    logger.warn({ err, key }, "Redis cache set failed");
  }
}

async function redisDelete(key: string): Promise<void> {
  if (!isRedisReady()) return;
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.del(REDIS_PREFIX + key);
  } catch (err) {
    logger.warn({ err, key }, "Redis cache delete failed");
  }
}

// ─── SQLite/DB layer (L3) ──────────────────────────────────────────

function dbGet(key: string): string | null {
  try {
    const rows = db
      .select({ value: cacheEntries.value, ttl: cacheEntries.ttl, createdAt: cacheEntries.createdAt })
      .from(cacheEntries)
      .where(eq(cacheEntries.key, key))
      .limit(1)
      .all();
    if (rows.length === 0) return null;
    const row = rows[0];
    const now = Math.floor(Date.now() / 1000);
    if (row.createdAt !== null && now - row.createdAt > row.ttl) {
      db.delete(cacheEntries).where(eq(cacheEntries.key, key)).run();
      return null;
    }
    return row.value;
  } catch (err) {
    logger.warn({ err, key }, "Cache DB get failed");
    return null;
  }
}

function dbSet(key: string, value: string, ttl: number): void {
  try {
    db.insert(cacheEntries)
      .values({ key, value, ttl })
      .onConflictDoUpdate({ target: cacheEntries.key, set: { value, ttl, createdAt: sql`(unixepoch())` } })
      .run();
  } catch (err) {
    logger.warn({ err, key }, "Cache DB set failed");
  }
}

function dbDelete(key: string): void {
  try {
    db.delete(cacheEntries).where(eq(cacheEntries.key, key)).run();
  } catch (err) {
    logger.warn({ err, key }, "Cache DB delete failed");
  }
}

// ─── Public API ─────────────────────────────────────────────────────

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Synchronous cache get. Checks L1 (memory) then L3 (SQLite).
 * Use cacheGetAsync for full Redis L2 support.
 */
export function cacheGet(key: string): string | null {
  const memHit = memGet(key);
  if (memHit !== null) {
    cacheStats.hits++;
    return memHit;
  }
  const dbHit = dbGet(key);
  if (dbHit !== null) {
    cacheStats.hits++;
    memSet(key, dbHit, DEFAULT_TTL);
    return dbHit;
  }
  cacheStats.misses++;
  return null;
}

/**
 * Async cache get with full Redis L2 support.
 * Checks L1 (memory) -> L2 (Redis) -> L3 (SQLite).
 */
export async function cacheGetAsync(key: string): Promise<string | null> {
  const memHit = memGet(key);
  if (memHit !== null) {
    cacheStats.hits++;
    return memHit;
  }

  const redisHit = await redisGet(key);
  if (redisHit !== null) {
    cacheStats.hits++;
    cacheStats.redisHits++;
    memSet(key, redisHit, DEFAULT_TTL);
    return redisHit;
  }
  cacheStats.redisMisses++;

  const dbHit = dbGet(key);
  if (dbHit !== null) {
    cacheStats.hits++;
    memSet(key, dbHit, DEFAULT_TTL);
    void redisSet(key, dbHit, DEFAULT_TTL);
    return dbHit;
  }
  cacheStats.misses++;
  return null;
}

/** Store a value in all cache layers (L1 + L2 + L3). */
export function cacheSet(key: string, value: string, ttl = DEFAULT_TTL): void {
  memSet(key, value, ttl);
  void redisSet(key, value, ttl);
  dbSet(key, value, ttl);
}

/** Delete a value from all cache layers. */
export function cacheDelete(key: string): void {
  memDelete(key);
  void redisDelete(key);
  dbDelete(key);
}

/** Clear all cache layers. */
export function cacheClear(): void {
  memStore.clear();
  try {
    db.delete(cacheEntries).run();
  } catch (err) {
    logger.warn({ err }, "Cache clear failed");
  }
}

// ─── Stats ──────────────────────────────────────────────────────────

const cacheStats = { hits: 0, misses: 0, redisHits: 0, redisMisses: 0 };

/** Get cache statistics including Redis metrics. */
export function getCacheStats() {
  const total = cacheStats.hits + cacheStats.misses;
  return {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    hitRate: total > 0 ? Math.round((cacheStats.hits / total) * 100) : 0,
    memEntries: memStore.size,
    redisHits: cacheStats.redisHits,
    redisMisses: cacheStats.redisMisses,
    redisEnabled: isRedisReady(),
  };
}

/** Reset all cache counters. */
export function resetCacheStats(): void {
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.redisHits = 0;
  cacheStats.redisMisses = 0;
}

/** Get all keys currently stored in the in-memory L1 cache. */
export function getMemoryKeys(): string[] {
  return Array.from(memStore.keys());
}
