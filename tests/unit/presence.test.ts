/**
 * Unit tests for the user presence system (src/lib/presence/index.ts).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn().mockReturnValue(null),
  isRedisReady: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/pubsub", () => {
  const listeners = new Map<string, Set<(ch: string, msg: string) => void>>();
  return {
    getPubSub: () => ({
      async publish(channel: string, message: string) {
        const set = listeners.get(channel);
        if (!set) return;
        for (const listener of set) {
          try { listener(channel, message); } catch { /* ignore */ }
        }
      },
      subscribe(channel: string, listener: (ch: string, msg: string) => void) {
        let set = listeners.get(channel);
        if (!set) { set = new Set(); listeners.set(channel, set); }
        set.add(listener);
        return () => {
          set!.delete(listener);
          if (set!.size === 0) listeners.delete(channel);
        };
      },
    }),
  };
});

// Mock WebSocket server publishToChannel
vi.mock("@/lib/websocket/server", () => ({
  publishToChannel: vi.fn(),
  broadcastToChannel: vi.fn(),
  getWss: vi.fn(),
  getConnectionStats: vi.fn().mockReturnValue({ total: 0, authenticated: 0, channels: {} }),
}));

describe("Presence system", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function loadPresence() {
    const mod = await import("@/lib/presence");
    mod.resetPresence();
    return mod;
  }

  describe("setPresence", () => {
    it("adds a user to a channel", async () => {
      const { setPresence, getPresence } = await loadPresence();

      await setPresence("project:123", "user-1", "Alice");
      const users = await getPresence("project:123");

      expect(users).toHaveLength(1);
      expect(users[0].userId).toBe("user-1");
      expect(users[0].userName).toBe("Alice");
    });

    it("updates lastSeen on repeated calls", async () => {
      const { setPresence, getPresence } = await loadPresence();

      await setPresence("project:123", "user-1");
      vi.advanceTimersByTime(5000);
      await setPresence("project:123", "user-1");

      const users = await getPresence("project:123");
      expect(users).toHaveLength(1);
      // lastSeen should be recent
      expect(Date.now() - users[0].lastSeen).toBeLessThan(1000);
    });

    it("supports multiple users in the same channel", async () => {
      const { setPresence, getPresence } = await loadPresence();

      await setPresence("project:123", "user-1", "Alice");
      await setPresence("project:123", "user-2", "Bob");
      await setPresence("project:123", "user-3", "Charlie");

      const users = await getPresence("project:123");
      expect(users).toHaveLength(3);
      expect(users.map((u) => u.userId).sort()).toEqual(["user-1", "user-2", "user-3"]);
    });

    it("supports same user in multiple channels", async () => {
      const { setPresence, getPresence } = await loadPresence();

      await setPresence("project:123", "user-1");
      await setPresence("project:456", "user-1");

      const users123 = await getPresence("project:123");
      const users456 = await getPresence("project:456");

      expect(users123).toHaveLength(1);
      expect(users456).toHaveLength(1);
    });

    it("broadcasts presence change for new users", async () => {
      const { setPresence } = await loadPresence();
      const { publishToChannel } = await import("@/lib/websocket/server");

      await setPresence("project:123", "user-1", "Alice");

      expect(publishToChannel).toHaveBeenCalledWith("project:123", {
        type: "presence",
        channel: "project:123",
        data: { userId: "user-1", status: "online", userName: "Alice" },
      });
    });
  });

  describe("removePresence", () => {
    it("removes a user from a channel", async () => {
      const { setPresence, removePresence, getPresence } = await loadPresence();

      await setPresence("project:123", "user-1");
      await removePresence("project:123", "user-1");

      const users = await getPresence("project:123");
      expect(users).toHaveLength(0);
    });

    it("broadcasts offline status", async () => {
      const { setPresence, removePresence } = await loadPresence();
      const { publishToChannel } = await import("@/lib/websocket/server");

      await setPresence("project:123", "user-1", "Alice");
      vi.mocked(publishToChannel).mockClear();

      await removePresence("project:123", "user-1", "Alice");

      expect(publishToChannel).toHaveBeenCalledWith("project:123", {
        type: "presence",
        channel: "project:123",
        data: { userId: "user-1", status: "offline", userName: "Alice" },
      });
    });

    it("does not affect other users", async () => {
      const { setPresence, removePresence, getPresence } = await loadPresence();

      await setPresence("project:123", "user-1");
      await setPresence("project:123", "user-2");
      await removePresence("project:123", "user-1");

      const users = await getPresence("project:123");
      expect(users).toHaveLength(1);
      expect(users[0].userId).toBe("user-2");
    });

    it("handles removing non-existent user gracefully", async () => {
      const { removePresence, getPresence } = await loadPresence();

      await removePresence("project:123", "unknown-user");
      const users = await getPresence("project:123");
      expect(users).toHaveLength(0);
    });
  });

  describe("getPresence", () => {
    it("returns empty array for unknown channel", async () => {
      const { getPresence } = await loadPresence();
      const users = await getPresence("project:unknown");
      expect(users).toEqual([]);
    });

    it("excludes expired entries", async () => {
      const { setPresence, getPresence } = await loadPresence();

      await setPresence("project:123", "user-1");
      // Advance past TTL (60s)
      vi.advanceTimersByTime(61_000);

      const users = await getPresence("project:123");
      expect(users).toHaveLength(0);
    });
  });

  describe("getPresenceCount", () => {
    it("returns 0 for empty channel", async () => {
      const { getPresenceCount } = await loadPresence();
      const count = await getPresenceCount("project:123");
      expect(count).toBe(0);
    });

    it("returns correct count", async () => {
      const { setPresence, getPresenceCount } = await loadPresence();

      await setPresence("project:123", "user-1");
      await setPresence("project:123", "user-2");

      const count = await getPresenceCount("project:123");
      expect(count).toBe(2);
    });
  });

  describe("heartbeatPresence", () => {
    it("refreshes user presence TTL", async () => {
      const { setPresence, heartbeatPresence, getPresence } = await loadPresence();

      await setPresence("project:123", "user-1");

      // Advance 50 seconds (close to TTL)
      vi.advanceTimersByTime(50_000);

      // Heartbeat refreshes
      await heartbeatPresence("project:123", "user-1");

      // Advance 50 more seconds (would have expired without heartbeat)
      vi.advanceTimersByTime(50_000);

      const users = await getPresence("project:123");
      expect(users).toHaveLength(1);
    });
  });

  describe("removeAllPresence", () => {
    it("removes user from all channels", async () => {
      const { setPresence, removeAllPresence, getPresence } = await loadPresence();

      await setPresence("project:123", "user-1");
      await setPresence("project:456", "user-1");
      await setPresence("project:789", "user-1");

      await removeAllPresence("user-1");

      expect(await getPresence("project:123")).toHaveLength(0);
      expect(await getPresence("project:456")).toHaveLength(0);
      expect(await getPresence("project:789")).toHaveLength(0);
    });

    it("does not affect other users", async () => {
      const { setPresence, removeAllPresence, getPresence } = await loadPresence();

      await setPresence("project:123", "user-1");
      await setPresence("project:123", "user-2");

      await removeAllPresence("user-1");

      const users = await getPresence("project:123");
      expect(users).toHaveLength(1);
      expect(users[0].userId).toBe("user-2");
    });
  });

  describe("TTL cleanup", () => {
    it("cleans up expired entries via timer", async () => {
      const { setPresence, getPresence } = await loadPresence();

      await setPresence("project:123", "user-1");
      await setPresence("project:123", "user-2");

      // Advance past TTL + cleanup interval
      vi.advanceTimersByTime(90_000);

      const users = await getPresence("project:123");
      expect(users).toHaveLength(0);
    });

    it("broadcasts offline for expired users", async () => {
      const { setPresence } = await loadPresence();
      const { publishToChannel } = await import("@/lib/websocket/server");

      await setPresence("project:123", "user-1", "Alice");
      vi.mocked(publishToChannel).mockClear();

      // Advance past TTL + cleanup interval
      vi.advanceTimersByTime(90_000);

      expect(publishToChannel).toHaveBeenCalledWith("project:123", {
        type: "presence",
        channel: "project:123",
        data: { userId: "user-1", status: "offline", userName: "Alice" },
      });
    });
  });

  describe("resetPresence", () => {
    it("clears all presence state", async () => {
      const { setPresence, resetPresence, getPresence } = await loadPresence();

      await setPresence("project:123", "user-1");
      await setPresence("project:456", "user-2");

      resetPresence();

      expect(await getPresence("project:123")).toHaveLength(0);
      expect(await getPresence("project:456")).toHaveLength(0);
    });
  });
});
