/**
 * LLM response cache using SHA-256 prompt hashing.
 * Cache entries expire after TTL (default 24 hours).
 */

import { createHash } from "crypto";
import { db } from "@/db";
import { llmCache } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

const cacheLog = logger.child({ module: "llm-cache" });

const DEFAULT_TTL = 86400; // 24 hours in seconds

export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex");
}

export interface CachedResponse {
  response: string;
  modelUsed: string | null;
}

/**
 * Look up a cached LLM response by prompt hash.
 * Returns null if not found or expired.
 */
export async function getCachedResponse(
  prompt: string
): Promise<CachedResponse | null> {
  const hash = hashPrompt(prompt);

  try {
    const rows = await db
      .select({
        response: llmCache.response,
        modelUsed: llmCache.modelUsed,
        createdAt: llmCache.createdAt,
        ttl: llmCache.ttl,
      })
      .from(llmCache)
      .where(eq(llmCache.hash, hash))
      .limit(1);

    if (rows.length === 0) {
      cacheLog.info({ hash: hash.slice(0, 12) }, "LLM cache miss");
      return null;
    }

    const row = rows[0];
    const createdAtSec = row.createdAt
      ? Math.floor(row.createdAt.getTime() / 1000)
      : 0;
    const nowSec = Math.floor(Date.now() / 1000);

    if (nowSec - createdAtSec > row.ttl) {
      cacheLog.info({ hash: hash.slice(0, 12), age: nowSec - createdAtSec }, "LLM cache expired");
      await db.delete(llmCache).where(eq(llmCache.hash, hash));
      return null;
    }

    cacheLog.info({ hash: hash.slice(0, 12) }, "LLM cache hit");
    return { response: row.response, modelUsed: row.modelUsed };
  } catch {
    return null;
  }
}

/**
 * Store an LLM response in the cache.
 */
export async function setCachedResponse(
  prompt: string,
  response: string,
  modelUsed: string | null,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  const hash = hashPrompt(prompt);

  try {
    await db
      .insert(llmCache)
      .values({
        hash,
        prompt,
        response,
        modelUsed,
        ttl,
      })
      .onConflictDoUpdate({
        target: llmCache.hash,
        set: {
          response,
          modelUsed,
          ttl,
          createdAt: sql`(unixepoch())`,
        },
      });
  } catch {
    // Silently fail — caching is best-effort
  }
}
