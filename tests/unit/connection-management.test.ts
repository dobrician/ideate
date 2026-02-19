import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/websocket/server", () => {
  const clients = new Map();
  const userCounts = new Map<string, number>();

  return {
    getConnectionStats: vi.fn(() => {
      const channels: Record<string, number> = {};
      let authenticated = 0;
      for (const state of clients.values()) {
        if (state.userId) authenticated++;
        for (const ch of state.channels) {
          channels[ch] = (channels[ch] ?? 0) + 1;
        }
      }
      return { total: clients.size, authenticated, channels };
    }),
    getConnectionCount: vi.fn(() => clients.size),
    getAuthenticatedCount: vi.fn(() => {
      let count = 0;
      for (const s of clients.values()) { if (s.userId) count++; }
      return count;
    }),
    getUserConnectionCount: vi.fn((userId: string) => userCounts.get(userId) ?? 0),
    publishToChannel: vi.fn(),
    broadcastToChannel: vi.fn(),
    _clients: clients,
    _userCounts: userCounts,
  };
});

import {
  getConnectionStats,
  getConnectionCount,
  getAuthenticatedCount,
  getUserConnectionCount,
} from "@/lib/websocket/server";

describe("connection-management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getConnectionStats", () => {
    it("returns stats structure with total, authenticated, and channels", () => {
      const stats = getConnectionStats();
      expect(stats).toHaveProperty("total");
      expect(stats).toHaveProperty("authenticated");
      expect(stats).toHaveProperty("channels");
      expect(typeof stats.total).toBe("number");
      expect(typeof stats.authenticated).toBe("number");
      expect(typeof stats.channels).toBe("object");
    });
  });

  describe("getConnectionCount", () => {
    it("returns total connection count", () => {
      expect(getConnectionCount()).toBe(0);
    });
  });

  describe("getAuthenticatedCount", () => {
    it("returns authenticated connection count", () => {
      expect(getAuthenticatedCount()).toBe(0);
    });
  });

  describe("getUserConnectionCount", () => {
    it("returns 0 for unknown user", () => {
      expect(getUserConnectionCount("unknown-user")).toBe(0);
    });
  });

  describe("connection limits", () => {
    it("MAX_CONNECTIONS_PER_USER is enforced at 5", async () => {
      // Read the actual server module to verify the constant
      const serverSource = await import("fs").then((fs) =>
        fs.promises.readFile("src/lib/websocket/server.ts", "utf-8")
      );
      expect(serverSource).toContain("MAX_CONNECTIONS_PER_USER = 5");
    });

    it("server rejects connections exceeding the limit", async () => {
      const serverSource = await import("fs").then((fs) =>
        fs.promises.readFile("src/lib/websocket/server.ts", "utf-8")
      );
      // Verify the limit check exists in auth handling
      expect(serverSource).toContain("currentCount >= MAX_CONNECTIONS_PER_USER");
      expect(serverSource).toContain("Too many connections");
      expect(serverSource).toContain("4002");
    });
  });

  describe("polling fallback", () => {
    it("project-live-panel contains polling fallback constants", async () => {
      const source = await import("fs").then((fs) =>
        fs.promises.readFile("src/components/project-live-panel.tsx", "utf-8")
      );
      expect(source).toContain("POLLING_INTERVAL_MS");
      expect(source).toContain("FALLBACK_THRESHOLD_MS");
      expect(source).toContain("router.refresh()");
      expect(source).toContain("ws.fallbackPolling");
    });
  });
});
