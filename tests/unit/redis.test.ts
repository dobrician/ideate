import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock ioredis with a class constructor
const mockPing = vi.fn();
const mockQuit = vi.fn();
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();

class MockRedis {
  ping = mockPing;
  quit = mockQuit;
  connect = mockConnect;
  on = mockOn;
  status = "ready";
}

vi.mock("ioredis", () => ({
  default: MockRedis,
}));

describe("Redis client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.REDIS_URL;
  });

  describe("getRedis", () => {
    it("returns null when REDIS_URL is not set", async () => {
      const { getRedis } = await import("@/lib/redis");
      expect(getRedis()).toBeNull();
    });

    it("returns a Redis client when REDIS_URL is set", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const { getRedis } = await import("@/lib/redis");
      const client = getRedis();
      expect(client).not.toBeNull();
      expect(mockConnect).toHaveBeenCalled();
    });

    it("returns the same client on subsequent calls", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const { getRedis } = await import("@/lib/redis");
      const client1 = getRedis();
      const client2 = getRedis();
      expect(client1).toBe(client2);
    });
  });

  describe("isRedisReady", () => {
    it("returns false when Redis is not configured", async () => {
      const { isRedisReady } = await import("@/lib/redis");
      expect(isRedisReady()).toBe(false);
    });
  });

  describe("checkRedisHealth", () => {
    it("returns 'disabled' when REDIS_URL is not set", async () => {
      const { checkRedisHealth } = await import("@/lib/redis");
      const result = await checkRedisHealth();
      expect(result).toBe("disabled");
    });

    it("returns 'ok' when ping succeeds", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      mockPing.mockResolvedValue("PONG");
      const { checkRedisHealth } = await import("@/lib/redis");
      const result = await checkRedisHealth();
      expect(result).toBe("ok");
    });

    it("returns 'error' when ping fails", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      mockPing.mockRejectedValue(new Error("Connection refused"));
      const { checkRedisHealth } = await import("@/lib/redis");
      const result = await checkRedisHealth();
      expect(result).toBe("error");
    });
  });

  describe("closeRedis", () => {
    it("closes the connection when client exists", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      mockQuit.mockResolvedValue("OK");
      const { getRedis, closeRedis } = await import("@/lib/redis");
      getRedis();
      await closeRedis();
      expect(mockQuit).toHaveBeenCalled();
    });

    it("does nothing when no client exists", async () => {
      const { closeRedis } = await import("@/lib/redis");
      await closeRedis();
      expect(mockQuit).not.toHaveBeenCalled();
    });
  });
});
