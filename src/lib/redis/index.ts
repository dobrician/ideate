/**
 * Redis client with optional connection.
 * Redis is optional — returns null when REDIS_URL is not set.
 * All consumers must handle the null case gracefully.
 */

import Redis from "ioredis";
import { logger } from "@/lib/logger";

let redisClient: Redis | null = null;
let redisReady = false;

/**
 * Get the shared Redis client instance.
 * Returns null when Redis is not configured (REDIS_URL not set).
 */
export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null; // stop retrying after 5 attempts
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redisClient.on("connect", () => {
      redisReady = true;
      logger.info("Redis connected");
    });

    redisClient.on("error", (err) => {
      redisReady = false;
      logger.warn({ err: err.message }, "Redis error");
    });

    redisClient.on("close", () => {
      redisReady = false;
    });

    redisClient.connect().catch((err) => {
      logger.warn({ err: err.message }, "Redis initial connection failed — operating without Redis");
    });
  }

  return redisClient;
}

/**
 * Check whether Redis is connected and ready.
 */
export function isRedisReady(): boolean {
  return redisReady && redisClient !== null && redisClient.status === "ready";
}

/**
 * Perform a Redis health check (PING).
 * Returns "ok" if Redis responds, "error" if it fails, "disabled" if not configured.
 */
export async function checkRedisHealth(): Promise<"ok" | "error" | "disabled"> {
  if (!process.env.REDIS_URL) return "disabled";
  try {
    const client = getRedis();
    if (!client) return "disabled";
    const result = await client.ping();
    return result === "PONG" ? "ok" : "error";
  } catch {
    return "error";
  }
}

/**
 * Gracefully close the Redis connection.
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
    redisReady = false;
  }
}
