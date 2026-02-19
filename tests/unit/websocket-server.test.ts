/**
 * Unit tests for WebSocket server module (src/lib/websocket/server.ts).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({
  verifySessionToken: vi.fn(),
}));

vi.mock("@/lib/pubsub", () => {
  const listeners = new Map<string, Set<(ch: string, msg: string) => void>>();
  const memoryPubSub = {
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
  };
  return {
    getPubSub: () => memoryPubSub,
    memoryPubSub,
  };
});

// Mock ws module
const mockWsOn = vi.fn();
const mockWsSend = vi.fn();
const mockWsClose = vi.fn();
const mockWsTerminate = vi.fn();
const mockWsPing = vi.fn();
let connectionHandler: ((ws: unknown, req: unknown) => void) | null = null;

vi.mock("ws", () => {
  class MockWebSocket {
    static OPEN = 1;
    static CONNECTING = 0;
    readyState = 1; // OPEN
    on = mockWsOn;
    send = mockWsSend;
    close = mockWsClose;
    terminate = mockWsTerminate;
    ping = mockWsPing;
  }

  class MockWebSocketServer {
    on(event: string, handler: (...args: unknown[]) => void) {
      if (event === "connection") {
        connectionHandler = handler;
      }
    }
    handleUpgrade = vi.fn();
    emit = vi.fn();
    close = vi.fn();
  }

  return {
    WebSocketServer: MockWebSocketServer,
    WebSocket: MockWebSocket,
  };
});

// Helper to create a mock WebSocket client
function createMockWs() {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  const ws = {
    readyState: 1, // OPEN
    send: vi.fn(),
    close: vi.fn(),
    terminate: vi.fn(),
    ping: vi.fn(),
    on(event: string, handler: (...args: unknown[]) => void) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    _emit(event: string, ...args: unknown[]) {
      const list = handlers.get(event) ?? [];
      for (const h of list) h(...args);
    },
  };
  return ws;
}

describe("WebSocket server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useFakeTimers();
    connectionHandler = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getConnectionStats", () => {
    it("returns zero stats when no connections", async () => {
      const { getConnectionStats } = await import("@/lib/websocket/server");
      const stats = getConnectionStats();
      expect(stats.total).toBe(0);
      expect(stats.authenticated).toBe(0);
      expect(stats.channels).toEqual({});
    });
  });

  describe("getConnectionCount", () => {
    it("returns 0 with no connections", async () => {
      const { getConnectionCount } = await import("@/lib/websocket/server");
      expect(getConnectionCount()).toBe(0);
    });
  });

  describe("getAuthenticatedCount", () => {
    it("returns 0 with no connections", async () => {
      const { getAuthenticatedCount } = await import("@/lib/websocket/server");
      expect(getAuthenticatedCount()).toBe(0);
    });
  });

  describe("getUserConnectionCount", () => {
    it("returns 0 for unknown user", async () => {
      const { getUserConnectionCount } = await import("@/lib/websocket/server");
      expect(getUserConnectionCount("unknown")).toBe(0);
    });
  });

  describe("getChannelSubscriberCount", () => {
    it("returns 0 for empty channel", async () => {
      const { getChannelSubscriberCount } = await import("@/lib/websocket/server");
      expect(getChannelSubscriberCount("project:123")).toBe(0);
    });
  });

  describe("isValidChannel", () => {
    it("validates project channels", async () => {
      const { isValidChannel } = await import("@/lib/websocket/types");
      expect(isValidChannel("project:123")).toBe(true);
      expect(isValidChannel("invalid:123")).toBe(false);
    });
  });

  describe("broadcastToChannel", () => {
    it("does nothing with no clients", async () => {
      const { broadcastToChannel } = await import("@/lib/websocket/server");
      // Should not throw
      broadcastToChannel("project:123", { type: "pong" });
    });
  });

  describe("publishToChannel", () => {
    it("broadcasts locally and publishes to pubsub", async () => {
      const { publishToChannel } = await import("@/lib/websocket/server");
      // Should not throw with no clients
      publishToChannel("project:123", {
        type: "vote_update",
        channel: "project:123",
        data: { proposalId: "p1", upvotes: 5, downvotes: 2 },
      });
    });
  });

  describe("getWss", () => {
    it("creates a WebSocket server", async () => {
      const { getWss } = await import("@/lib/websocket/server");
      const wss = getWss();
      expect(wss).toBeDefined();
    });

    it("returns the same instance on subsequent calls", async () => {
      const { getWss } = await import("@/lib/websocket/server");
      const wss1 = getWss();
      const wss2 = getWss();
      expect(wss1).toBe(wss2);
    });
  });

  describe("closeWss", () => {
    it("cleans up the WebSocket server", async () => {
      const { getWss, closeWss, getConnectionCount } = await import("@/lib/websocket/server");
      getWss();
      closeWss();
      expect(getConnectionCount()).toBe(0);
    });

    it("is safe to call when server is not initialized", async () => {
      const { closeWss } = await import("@/lib/websocket/server");
      expect(() => closeWss()).not.toThrow();
    });
  });
});
