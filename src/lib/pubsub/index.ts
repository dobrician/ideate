/**
 * Pub/Sub abstraction with Redis and in-memory implementations.
 * Automatically selects Redis when REDIS_URL is configured, falls back to memory.
 */

import { getRedis, isRedisReady } from "@/lib/redis";
import { logger } from "@/lib/logger";
import Redis from "ioredis";

export type PubSubListener = (channel: string, message: string) => void;

export interface PubSub {
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, listener: PubSubListener): () => void;
}

// ─── Memory Pub/Sub ─────────────────────────────────────────────────

const memListeners = new Map<string, Set<PubSubListener>>();

export const memoryPubSub: PubSub = {
  async publish(channel: string, message: string) {
    const set = memListeners.get(channel);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(channel, message);
      } catch {
        // listener errors should not break the publisher
      }
    }
  },

  subscribe(channel: string, listener: PubSubListener): () => void {
    let set = memListeners.get(channel);
    if (!set) {
      set = new Set();
      memListeners.set(channel, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) memListeners.delete(channel);
    };
  },
};

// ─── Redis Pub/Sub ──────────────────────────────────────────────────

let redisSub: Redis | null = null;
const redisChannelListeners = new Map<string, Set<PubSubListener>>();

function getRedisSubscriber(): Redis | null {
  if (redisSub) return redisSub;
  const client = getRedis();
  if (!client) return null;

  // Create a dedicated subscriber connection (Redis requires separate connections for pub/sub)
  redisSub = client.duplicate();
  redisSub.on("message", (channel: string, message: string) => {
    const set = redisChannelListeners.get(channel);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(channel, message);
      } catch {
        // listener errors should not break the subscriber
      }
    }
  });

  redisSub.on("error", (err) => {
    logger.warn({ err: err.message }, "Redis subscriber error");
  });

  return redisSub;
}

export const redisPubSub: PubSub = {
  async publish(channel: string, message: string) {
    const client = getRedis();
    if (!client) return;
    try {
      await client.publish(channel, message);
    } catch (err) {
      logger.warn({ err, channel }, "Redis publish failed");
    }
  },

  subscribe(channel: string, listener: PubSubListener): () => void {
    const sub = getRedisSubscriber();
    if (!sub) return () => {};

    let set = redisChannelListeners.get(channel);
    if (!set) {
      set = new Set();
      redisChannelListeners.set(channel, set);
      sub.subscribe(channel).catch((err) => {
        logger.warn({ err, channel }, "Redis subscribe failed");
      });
    }
    set.add(listener);

    return () => {
      set!.delete(listener);
      if (set!.size === 0) {
        redisChannelListeners.delete(channel);
        sub.unsubscribe(channel).catch(() => {});
      }
    };
  },
};

// ─── Auto-selecting Pub/Sub ─────────────────────────────────────────

/**
 * Get the best available pub/sub implementation.
 * Uses Redis when available, falls back to in-memory.
 */
export function getPubSub(): PubSub {
  if (process.env.REDIS_URL && isRedisReady()) {
    return redisPubSub;
  }
  return memoryPubSub;
}
