import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";

// ─── Key Generation ─────────────────────────────────────────────────────

const KEY_PREFIX = "idk_"; // "ideate key"
const KEY_LENGTH = 32;

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const random = randomBytes(KEY_LENGTH).toString("hex");
  const raw = `${KEY_PREFIX}${random}`;
  const hash = hashKey(raw);
  const prefix = raw.slice(0, 12); // "idk_" + first 8 hex chars
  return { raw, hash, prefix };
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// ─── Tier Configuration ─────────────────────────────────────────────────

export type ApiKeyTier = "basic" | "pro" | "enterprise";

export interface TierConfig {
  rateLimit: number;
  rateLimitWindow: number; // seconds
  maxKeys: number;
}

export const TIER_CONFIGS: Record<ApiKeyTier, TierConfig> = {
  basic: { rateLimit: 100, rateLimitWindow: 3600, maxKeys: 3 },
  pro: { rateLimit: 1000, rateLimitWindow: 3600, maxKeys: 10 },
  enterprise: { rateLimit: 10000, rateLimitWindow: 3600, maxKeys: 50 },
};

// ─── Scopes ─────────────────────────────────────────────────────────────

export const API_SCOPES = [
  "read:projects",
  "write:projects",
  "read:proposals",
  "write:proposals",
  "read:votes",
  "read:users",
  "read:analytics",
  "webhooks:manage",
] as const;

export type ApiScope = typeof API_SCOPES[number];

export function validateScopes(scopes: string[]): boolean {
  return scopes.every((s) => (API_SCOPES as readonly string[]).includes(s));
}

// ─── Key Operations ─────────────────────────────────────────────────────

export interface CreateKeyOptions {
  name: string;
  userId: string;
  scopes: ApiScope[];
  tier?: ApiKeyTier;
  expiresAt?: Date;
}

export async function createApiKey(options: CreateKeyOptions): Promise<{
  id: string;
  rawKey: string;
  prefix: string;
}> {
  const { raw, hash, prefix } = generateApiKey();
  const tier = options.tier || "basic";
  const tierConfig = TIER_CONFIGS[tier];

  const id = crypto.randomUUID();

  await db.insert(apiKeys).values({
    id,
    name: options.name,
    keyHash: hash,
    keyPrefix: prefix,
    userId: options.userId,
    scopes: JSON.stringify(options.scopes),
    tier,
    rateLimit: tierConfig.rateLimit,
    rateLimitWindow: tierConfig.rateLimitWindow,
    expiresAt: options.expiresAt ?? null,
  });

  return { id, rawKey: raw, prefix };
}

export interface ValidatedKey {
  id: string;
  userId: string;
  scopes: ApiScope[];
  tier: ApiKeyTier;
  rateLimit: number;
  rateLimitWindow: number;
}

/**
 * Validate an API key and return its metadata.
 * Returns null if key is invalid, revoked, or expired.
 */
export async function validateApiKey(rawKey: string): Promise<ValidatedKey | null> {
  if (!rawKey.startsWith(KEY_PREFIX)) return null;

  const hash = hashKey(rawKey);
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.revoked, false)))
    .limit(1);

  if (!key) return null;

  // Timing-safe comparison of hashes to prevent timing attacks
  try {
    const storedHashBuffer = Buffer.from(key.keyHash, "hex");
    const inputHashBuffer = Buffer.from(hash, "hex");
    if (!timingSafeEqual(storedHashBuffer, inputHashBuffer)) return null;
  } catch {
    return null;
  }

  // Check expiry
  if (key.expiresAt && key.expiresAt < new Date()) return null;

  // Update last used + total requests
  await db
    .update(apiKeys)
    .set({
      lastUsedAt: new Date(),
      totalRequests: sql`total_requests + 1`,
    })
    .where(eq(apiKeys.id, key.id));

  return {
    id: key.id,
    userId: key.userId,
    scopes: JSON.parse(key.scopes) as ApiScope[],
    tier: key.tier as ApiKeyTier,
    rateLimit: key.rateLimit,
    rateLimitWindow: key.rateLimitWindow,
  };
}

/**
 * Check rate limit for an API key.
 */
export function checkApiKeyRateLimit(keyId: string, rateLimit: number, windowSeconds: number) {
  return checkRateLimit(`apikey:${keyId}`, rateLimit, windowSeconds * 1000);
}

/**
 * Revoke an API key.
 */
export async function revokeApiKey(keyId: string): Promise<boolean> {
  const result = await db
    .update(apiKeys)
    .set({ revoked: true })
    .where(eq(apiKeys.id, keyId));
  return true;
}

/**
 * List API keys for a user (without hash).
 */
export async function listApiKeys(userId: string) {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      tier: apiKeys.tier,
      rateLimit: apiKeys.rateLimit,
      rateLimitWindow: apiKeys.rateLimitWindow,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      revoked: apiKeys.revoked,
      totalRequests: apiKeys.totalRequests,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));
}

/**
 * Get usage statistics for all API keys.
 */
export async function getApiKeyStats(): Promise<{
  totalKeys: number;
  activeKeys: number;
  revokedKeys: number;
  totalRequests: number;
}> {
  const [stats] = await db
    .select({
      totalKeys: sql<number>`COUNT(*)`,
      activeKeys: sql<number>`SUM(CASE WHEN revoked = 0 THEN 1 ELSE 0 END)`,
      revokedKeys: sql<number>`SUM(CASE WHEN revoked = 1 THEN 1 ELSE 0 END)`,
      totalRequests: sql<number>`SUM(total_requests)`,
    })
    .from(apiKeys);

  return {
    totalKeys: Number(stats?.totalKeys ?? 0),
    activeKeys: Number(stats?.activeKeys ?? 0),
    revokedKeys: Number(stats?.revokedKeys ?? 0),
    totalRequests: Number(stats?.totalRequests ?? 0),
  };
}
