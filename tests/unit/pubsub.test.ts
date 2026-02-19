import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn().mockReturnValue(null),
  isRedisReady: vi.fn().mockReturnValue(false),
}));

vi.mock("ioredis", () => ({
  default: class MockRedis {
    on = vi.fn();
    subscribe = vi.fn().mockResolvedValue(undefined);
    unsubscribe = vi.fn().mockResolvedValue(undefined);
    publish = vi.fn().mockResolvedValue(1);
    duplicate = vi.fn().mockReturnValue({
      on: vi.fn(),
      subscribe: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
    });
  },
}));

describe("Pub/Sub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("memoryPubSub", () => {
    it("delivers messages to subscribers", async () => {
      const { memoryPubSub } = await import("@/lib/pubsub");
      const listener = vi.fn();

      memoryPubSub.subscribe("test-channel", listener);
      await memoryPubSub.publish("test-channel", "hello");

      expect(listener).toHaveBeenCalledWith("test-channel", "hello");
    });

    it("does not deliver to unsubscribed listeners", async () => {
      const { memoryPubSub } = await import("@/lib/pubsub");
      const listener = vi.fn();

      const unsub = memoryPubSub.subscribe("test-channel", listener);
      unsub();
      await memoryPubSub.publish("test-channel", "hello");

      expect(listener).not.toHaveBeenCalled();
    });

    it("delivers to multiple subscribers on the same channel", async () => {
      const { memoryPubSub } = await import("@/lib/pubsub");
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      memoryPubSub.subscribe("ch", listener1);
      memoryPubSub.subscribe("ch", listener2);
      await memoryPubSub.publish("ch", "msg");

      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledOnce();
    });

    it("does not deliver to listeners on other channels", async () => {
      const { memoryPubSub } = await import("@/lib/pubsub");
      const listener = vi.fn();

      memoryPubSub.subscribe("channel-a", listener);
      await memoryPubSub.publish("channel-b", "msg");

      expect(listener).not.toHaveBeenCalled();
    });

    it("handles listener errors gracefully", async () => {
      const { memoryPubSub } = await import("@/lib/pubsub");
      const throwingListener = vi.fn().mockImplementation(() => { throw new Error("oops"); });
      const normalListener = vi.fn();

      memoryPubSub.subscribe("ch", throwingListener);
      memoryPubSub.subscribe("ch", normalListener);

      await expect(memoryPubSub.publish("ch", "msg")).resolves.not.toThrow();
      expect(normalListener).toHaveBeenCalledOnce();
    });

    it("cleans up channel when last listener unsubscribes", async () => {
      const { memoryPubSub } = await import("@/lib/pubsub");
      const listener = vi.fn();

      const unsub = memoryPubSub.subscribe("ch", listener);
      unsub();

      // Publishing should do nothing
      await memoryPubSub.publish("ch", "msg");
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("getPubSub", () => {
    it("returns memoryPubSub when Redis is not configured", async () => {
      const { getPubSub, memoryPubSub } = await import("@/lib/pubsub");
      const pubsub = getPubSub();
      expect(pubsub).toBe(memoryPubSub);
    });

    it("returns memoryPubSub when Redis is configured but not ready", async () => {
      const redis = await import("@/lib/redis");
      vi.mocked(redis.isRedisReady).mockReturnValue(false);
      process.env.REDIS_URL = "redis://localhost:6379";

      const { getPubSub, memoryPubSub } = await import("@/lib/pubsub");
      const pubsub = getPubSub();
      expect(pubsub).toBe(memoryPubSub);

      delete process.env.REDIS_URL;
    });

    it("returns redisPubSub when Redis is ready", async () => {
      const redis = await import("@/lib/redis");
      vi.mocked(redis.isRedisReady).mockReturnValue(true);
      process.env.REDIS_URL = "redis://localhost:6379";

      const { getPubSub, redisPubSub } = await import("@/lib/pubsub");
      const pubsub = getPubSub();
      expect(pubsub).toBe(redisPubSub);

      delete process.env.REDIS_URL;
    });
  });
});
