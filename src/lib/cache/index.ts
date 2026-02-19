import { db } from "@/db";
import { cacheEntries } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

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

// ─── SQLite layer (L2) ─────────────────────────────────────────────

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

export function cacheSet(key: string, value: string, ttl = DEFAULT_TTL): void {
  memSet(key, value, ttl);
  dbSet(key, value, ttl);
}

export function cacheDelete(key: string): void {
  memDelete(key);
  dbDelete(key);
}

export function cacheClear(): void {
  memStore.clear();
  try {
    db.delete(cacheEntries).run();
  } catch (err) {
    logger.warn({ err }, "Cache clear failed");
  }
}

// ─── Stats ──────────────────────────────────────────────────────────

const cacheStats = { hits: 0, misses: 0 };

export function getCacheStats() {
  const total = cacheStats.hits + cacheStats.misses;
  return {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    hitRate: total > 0 ? Math.round((cacheStats.hits / total) * 100) : 0,
    memEntries: memStore.size,
  };
}

export function resetCacheStats(): void {
  cacheStats.hits = 0;
  cacheStats.misses = 0;
}
