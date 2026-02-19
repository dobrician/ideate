/**
 * User presence tracking system.
 * Tracks which users are online in which projects/proposals.
 *
 * Uses Redis when available (with TTL-based expiry) or falls back
 * to in-memory tracking for single-instance deployments.
 *
 * Presence entries auto-expire after PRESENCE_TTL_MS without a heartbeat.
 */

import { getRedis, isRedisReady } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { publishToChannel } from "@/lib/websocket/server";
import type { WsPresenceMessage } from "@/lib/websocket/types";

const PRESENCE_TTL_MS = 60_000; // 60 seconds
const PRESENCE_TTL_SECONDS = Math.ceil(PRESENCE_TTL_MS / 1000);
const CLEANUP_INTERVAL_MS = 30_000;
const REDIS_PREFIX = "presence:";

export interface PresenceUser {
  userId: string;
  userName?: string;
  lastSeen: number;
}

export interface PresenceInfo {
  channel: string;
  users: PresenceUser[];
}

// ─── In-memory presence store ────────────────────────────────────────

interface MemoryEntry {
  userId: string;
  userName?: string;
  lastSeen: number;
}

/** channel -> userId -> entry */
const memStore = new Map<string, Map<string, MemoryEntry>>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [channel, users] of memStore) {
      for (const [userId, entry] of users) {
        if (now - entry.lastSeen > PRESENCE_TTL_MS) {
          users.delete(userId);
          broadcastPresenceChange(channel, userId, "offline", entry.userName);
        }
      }
      if (users.size === 0) memStore.delete(channel);
    }
    if (memStore.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);
}

// ─── Presence broadcast ──────────────────────────────────────────────

function broadcastPresenceChange(
  channel: string,
  userId: string,
  status: "online" | "offline",
  userName?: string,
): void {
  const msg: WsPresenceMessage = {
    type: "presence",
    channel,
    data: { userId, status, userName },
  };
  try {
    publishToChannel(channel, msg);
  } catch {
    // WebSocket server may not be initialized
  }
}

// ─── Redis presence operations ───────────────────────────────────────

async function redisSetPresence(
  channel: string,
  userId: string,
  userName?: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const key = `${REDIS_PREFIX}${channel}`;
  const value = JSON.stringify({ userId, userName, lastSeen: Date.now() });

  try {
    await redis.hset(key, userId, value);
    await redis.expire(key, PRESENCE_TTL_SECONDS * 2); // hash-level TTL
  } catch (err) {
    logger.warn({ err, channel, userId }, "Redis presence set failed");
  }
}

async function redisRemovePresence(
  channel: string,
  userId: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.hdel(`${REDIS_PREFIX}${channel}`, userId);
  } catch (err) {
    logger.warn({ err, channel, userId }, "Redis presence remove failed");
  }
}

async function redisGetPresence(channel: string): Promise<PresenceUser[]> {
  const redis = getRedis();
  if (!redis) return [];

  try {
    const entries = await redis.hgetall(`${REDIS_PREFIX}${channel}`);
    const now = Date.now();
    const users: PresenceUser[] = [];

    for (const value of Object.values(entries)) {
      try {
        const entry = JSON.parse(value) as MemoryEntry;
        if (now - entry.lastSeen <= PRESENCE_TTL_MS) {
          users.push({
            userId: entry.userId,
            userName: entry.userName,
            lastSeen: entry.lastSeen,
          });
        }
      } catch {
        // ignore malformed entries
      }
    }

    return users;
  } catch (err) {
    logger.warn({ err, channel }, "Redis presence get failed");
    return [];
  }
}

// ─── Public API ──────────────────────────────────────────────────────

function shouldUseRedis(): boolean {
  return !!process.env.REDIS_URL && isRedisReady();
}

/**
 * Mark a user as present in a channel.
 * Call this on connection and periodically as a heartbeat.
 */
export async function setPresence(
  channel: string,
  userId: string,
  userName?: string,
): Promise<void> {
  if (shouldUseRedis()) {
    await redisSetPresence(channel, userId, userName);
  } else {
    let users = memStore.get(channel);
    const isNew = !users || !users.has(userId);
    if (!users) {
      users = new Map();
      memStore.set(channel, users);
    }
    users.set(userId, { userId, userName, lastSeen: Date.now() });
    ensureCleanupTimer();

    if (isNew) {
      broadcastPresenceChange(channel, userId, "online", userName);
    }
  }
}

/**
 * Remove a user's presence from a channel.
 * Call this on disconnect or when leaving a channel.
 */
export async function removePresence(
  channel: string,
  userId: string,
  userName?: string,
): Promise<void> {
  if (shouldUseRedis()) {
    await redisRemovePresence(channel, userId);
  } else {
    const users = memStore.get(channel);
    if (users) {
      users.delete(userId);
      if (users.size === 0) memStore.delete(channel);
    }
  }
  broadcastPresenceChange(channel, userId, "offline", userName);
}

/**
 * Get all present users in a channel.
 */
export async function getPresence(channel: string): Promise<PresenceUser[]> {
  if (shouldUseRedis()) {
    return redisGetPresence(channel);
  }

  const users = memStore.get(channel);
  if (!users) return [];

  const now = Date.now();
  const result: PresenceUser[] = [];
  for (const entry of users.values()) {
    if (now - entry.lastSeen <= PRESENCE_TTL_MS) {
      result.push({
        userId: entry.userId,
        userName: entry.userName,
        lastSeen: entry.lastSeen,
      });
    }
  }
  return result;
}

/**
 * Get the count of present users in a channel.
 */
export async function getPresenceCount(channel: string): Promise<number> {
  const users = await getPresence(channel);
  return users.length;
}

/**
 * Heartbeat: refresh a user's presence TTL.
 */
export async function heartbeatPresence(
  channel: string,
  userId: string,
  userName?: string,
): Promise<void> {
  await setPresence(channel, userId, userName);
}

/**
 * Remove all presence entries for a user across all channels.
 * Called when a user disconnects entirely.
 */
export async function removeAllPresence(
  userId: string,
  userName?: string,
): Promise<void> {
  // In-memory cleanup
  for (const [channel, users] of memStore) {
    if (users.has(userId)) {
      users.delete(userId);
      if (users.size === 0) memStore.delete(channel);
      broadcastPresenceChange(channel, userId, "offline", userName);
    }
  }

  // Redis cleanup is not practical without scanning all keys,
  // so rely on TTL expiry for Redis-backed presence.
}

/**
 * Reset presence state (for testing).
 */
export function resetPresence(): void {
  memStore.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
