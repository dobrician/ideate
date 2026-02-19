/**
 * Unit tests for WebSocket client library (src/lib/websocket/client.ts).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock WebSocket class for Node test environment
class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    // Track instances for testing
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(_code?: number, _reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }

  // Test helpers
  _simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) this.onopen();
  }

  _simulateMessage(data: string) {
    if (this.onmessage) this.onmessage({ data });
  }

  _simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }

  _simulateError() {
    if (this.onerror) this.onerror();
  }

  static instances: MockWebSocket[] = [];
  static reset() {
    MockWebSocket.instances = [];
  }
}

// Install mock
const originalWebSocket = globalThis.WebSocket;

describe("WebSocket client", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.reset();
    (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = originalWebSocket;
  });

  async function loadClient() {
    vi.resetModules();
    const mod = await import("@/lib/websocket/client");
    return mod;
  }

  function getLastWs(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }

  describe("createWsClient", () => {
    it("creates a client in disconnected state", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({ token: "test-token", url: "ws://localhost/ws" });
      expect(client.state).toBe("disconnected");
    });

    it("connects and sends auth message on connect", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({ token: "test-token", url: "ws://localhost/ws" });

      client.connect();
      expect(client.state).toBe("connecting");

      const ws = getLastWs();
      ws._simulateOpen();

      expect(client.state).toBe("authenticating");
      expect(ws.sent.length).toBe(1);
      expect(JSON.parse(ws.sent[0])).toEqual({ type: "auth", token: "test-token" });
    });

    it("transitions to connected state on auth_ok", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({ token: "test-token", url: "ws://localhost/ws" });

      client.connect();
      const ws = getLastWs();
      ws._simulateOpen();
      ws._simulateMessage(JSON.stringify({ type: "auth_ok", userId: "user-1" }));

      expect(client.state).toBe("connected");
    });

    it("disconnects on auth_error", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({ token: "bad-token", url: "ws://localhost/ws" });

      client.connect();
      const ws = getLastWs();
      ws._simulateOpen();
      ws._simulateMessage(JSON.stringify({ type: "auth_error", reason: "Invalid token" }));

      expect(client.state).toBe("disconnected");
    });
  });

  describe("reconnection", () => {
    it("reconnects with exponential backoff on close", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({
        token: "test-token",
        url: "ws://localhost/ws",
        reconnectBaseMs: 100,
        reconnectMaxMs: 1000,
      });

      client.connect();
      const ws1 = getLastWs();
      ws1._simulateOpen();
      ws1._simulateMessage(JSON.stringify({ type: "auth_ok", userId: "user-1" }));

      // Simulate connection loss
      ws1._simulateClose();
      expect(client.state).toBe("disconnected");

      // After 100ms, should reconnect
      vi.advanceTimersByTime(100);
      expect(MockWebSocket.instances.length).toBe(2);
    });

    it("does not reconnect on intentional disconnect", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({
        token: "test-token",
        url: "ws://localhost/ws",
        reconnectBaseMs: 100,
      });

      client.connect();
      const ws = getLastWs();
      ws._simulateOpen();

      client.disconnect();
      vi.advanceTimersByTime(10000);

      // Should only have 1 instance (the original)
      expect(MockWebSocket.instances.length).toBe(1);
    });

    it("respects max reconnect attempts", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({
        token: "test-token",
        url: "ws://localhost/ws",
        reconnectBaseMs: 10,
        reconnectMaxMs: 50,
        maxReconnectAttempts: 2,
      });

      client.connect();
      const ws1 = getLastWs();
      ws1._simulateClose();

      // First reconnect
      vi.advanceTimersByTime(10);
      const ws2 = getLastWs();
      ws2._simulateClose();

      // Second reconnect
      vi.advanceTimersByTime(20);
      const ws3 = getLastWs();
      ws3._simulateClose();

      // No more reconnects
      vi.advanceTimersByTime(100);
      expect(MockWebSocket.instances.length).toBe(3); // original + 2 reconnects
    });
  });

  describe("heartbeat", () => {
    it("sends ping messages at the configured interval", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({
        token: "test-token",
        url: "ws://localhost/ws",
        heartbeatIntervalMs: 100,
      });

      client.connect();
      const ws = getLastWs();
      ws._simulateOpen();
      ws._simulateMessage(JSON.stringify({ type: "auth_ok", userId: "user-1" }));

      // auth message was sent
      expect(ws.sent.length).toBe(1);

      // After heartbeat interval, a ping should be sent
      vi.advanceTimersByTime(100);
      expect(ws.sent.length).toBe(2);
      expect(JSON.parse(ws.sent[1])).toEqual({ type: "ping" });
    });

    it("stops heartbeat on disconnect", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({
        token: "test-token",
        url: "ws://localhost/ws",
        heartbeatIntervalMs: 100,
      });

      client.connect();
      const ws = getLastWs();
      ws._simulateOpen();
      ws._simulateMessage(JSON.stringify({ type: "auth_ok", userId: "user-1" }));

      client.disconnect();

      const sentCount = ws.sent.length;
      vi.advanceTimersByTime(500);
      // No new messages should be sent
      expect(ws.sent.length).toBe(sentCount);
    });
  });

  describe("channel subscriptions", () => {
    it("sends subscribe message when connected", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({ token: "test-token", url: "ws://localhost/ws" });

      client.connect();
      const ws = getLastWs();
      ws._simulateOpen();
      ws._simulateMessage(JSON.stringify({ type: "auth_ok", userId: "user-1" }));

      const handler = vi.fn();
      client.subscribe("project:123", handler);

      // Should send subscribe message
      const lastSent = JSON.parse(ws.sent[ws.sent.length - 1]);
      expect(lastSent).toEqual({ type: "subscribe", channel: "project:123" });
    });

    it("re-subscribes to channels on reconnect", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({
        token: "test-token",
        url: "ws://localhost/ws",
        reconnectBaseMs: 10,
      });

      // Connect and subscribe
      client.connect();
      const ws1 = getLastWs();
      ws1._simulateOpen();
      ws1._simulateMessage(JSON.stringify({ type: "auth_ok", userId: "user-1" }));

      const handler = vi.fn();
      client.subscribe("project:123", handler);

      // Disconnect and reconnect
      ws1._simulateClose();
      vi.advanceTimersByTime(10);

      const ws2 = getLastWs();
      ws2._simulateOpen();
      ws2._simulateMessage(JSON.stringify({ type: "auth_ok", userId: "user-1" }));

      // Should have re-subscribed
      const subscribeMsgs = ws2.sent
        .map((s) => JSON.parse(s))
        .filter((m: { type: string }) => m.type === "subscribe");
      expect(subscribeMsgs).toContainEqual({ type: "subscribe", channel: "project:123" });
    });

    it("routes channel messages to handlers", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({ token: "test-token", url: "ws://localhost/ws" });

      client.connect();
      const ws = getLastWs();
      ws._simulateOpen();
      ws._simulateMessage(JSON.stringify({ type: "auth_ok", userId: "user-1" }));

      const handler = vi.fn();
      client.subscribe("project:123", handler);

      // Simulate incoming message for this channel
      ws._simulateMessage(JSON.stringify({
        type: "vote_update",
        channel: "project:123",
        data: { proposalId: "p1", upvotes: 5, downvotes: 2 },
      }));

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].type).toBe("vote_update");
    });

    it("unsubscribe callback removes handler", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({ token: "test-token", url: "ws://localhost/ws" });

      client.connect();
      const ws = getLastWs();
      ws._simulateOpen();
      ws._simulateMessage(JSON.stringify({ type: "auth_ok", userId: "user-1" }));

      const handler = vi.fn();
      const unsub = client.subscribe("project:123", handler);
      unsub();

      // Should send unsubscribe
      const lastSent = JSON.parse(ws.sent[ws.sent.length - 1]);
      expect(lastSent).toEqual({ type: "unsubscribe", channel: "project:123" });
    });
  });

  describe("message queuing", () => {
    it("queues messages when disconnected", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({ token: "test-token", url: "ws://localhost/ws" });

      // Send a message before connecting
      client.sendMessage({ type: "ping" });

      // Connect and authenticate
      client.connect();
      const ws = getLastWs();
      ws._simulateOpen();
      ws._simulateMessage(JSON.stringify({ type: "auth_ok", userId: "user-1" }));

      // The queued message should be flushed (auth + ping)
      const messages = ws.sent.map((s) => JSON.parse(s));
      expect(messages).toContainEqual({ type: "ping" });
    });

    it("respects max queue size", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({
        token: "test-token",
        url: "ws://localhost/ws",
        maxQueueSize: 3,
      });

      // Queue more than max
      for (let i = 0; i < 5; i++) {
        client.sendMessage({ type: "ping" });
      }

      client.connect();
      const ws = getLastWs();
      ws._simulateOpen();
      ws._simulateMessage(JSON.stringify({ type: "auth_ok", userId: "user-1" }));

      // Only 3 queued messages + auth should be sent
      const pings = ws.sent
        .map((s) => JSON.parse(s))
        .filter((m: { type: string }) => m.type === "ping");
      expect(pings.length).toBe(3);
    });
  });

  describe("state change handlers", () => {
    it("notifies on state changes", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({ token: "test-token", url: "ws://localhost/ws" });

      const stateChanges: string[] = [];
      client.onStateChange((s) => stateChanges.push(s));

      client.connect();
      const ws = getLastWs();
      ws._simulateOpen();
      ws._simulateMessage(JSON.stringify({ type: "auth_ok", userId: "user-1" }));

      expect(stateChanges).toEqual(["connecting", "authenticating", "connected"]);
    });

    it("unsubscribe removes handler", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({ token: "test-token", url: "ws://localhost/ws" });

      const stateChanges: string[] = [];
      const unsub = client.onStateChange((s) => stateChanges.push(s));
      unsub();

      client.connect();
      expect(stateChanges.length).toBe(0);
    });
  });

  describe("global message handlers", () => {
    it("receives all incoming messages", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({ token: "test-token", url: "ws://localhost/ws" });

      const messages: unknown[] = [];
      client.onMessage((m) => messages.push(m));

      client.connect();
      const ws = getLastWs();
      ws._simulateOpen();
      ws._simulateMessage(JSON.stringify({ type: "auth_ok", userId: "user-1" }));
      ws._simulateMessage(JSON.stringify({ type: "pong" }));

      expect(messages.length).toBe(2);
    });
  });

  describe("updateToken", () => {
    it("updates the token for future connections", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({
        token: "old-token",
        url: "ws://localhost/ws",
        reconnectBaseMs: 10,
      });

      client.connect();
      const ws1 = getLastWs();
      ws1._simulateOpen();

      // Verify initial auth uses old token
      expect(JSON.parse(ws1.sent[0])).toEqual({ type: "auth", token: "old-token" });

      // Update token
      client.updateToken("new-token");

      // Simulate reconnect
      ws1._simulateClose();
      vi.advanceTimersByTime(10);

      const ws2 = getLastWs();
      ws2._simulateOpen();

      // Verify reconnect auth uses new token
      expect(JSON.parse(ws2.sent[0])).toEqual({ type: "auth", token: "new-token" });
    });
  });

  describe("disconnect", () => {
    it("clears message queue", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({ token: "test-token", url: "ws://localhost/ws" });

      client.sendMessage({ type: "ping" });
      client.sendMessage({ type: "ping" });
      client.disconnect();

      // Connect fresh — no queued messages should be flushed
      client.connect();
      const ws = getLastWs();
      ws._simulateOpen();
      ws._simulateMessage(JSON.stringify({ type: "auth_ok", userId: "user-1" }));

      const pings = ws.sent
        .map((s) => JSON.parse(s))
        .filter((m: { type: string }) => m.type === "ping");
      expect(pings.length).toBe(0);
    });
  });

  describe("error handling", () => {
    it("handles invalid JSON gracefully", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({ token: "test-token", url: "ws://localhost/ws" });

      client.connect();
      const ws = getLastWs();
      ws._simulateOpen();

      // Should not throw
      ws._simulateMessage("not valid json");
      expect(client.state).toBe("authenticating");
    });

    it("handles handler errors without breaking", async () => {
      const { createWsClient } = await loadClient();
      const client = createWsClient({ token: "test-token", url: "ws://localhost/ws" });

      const throwingHandler = vi.fn().mockImplementation(() => {
        throw new Error("handler error");
      });
      client.onMessage(throwingHandler);

      client.connect();
      const ws = getLastWs();
      ws._simulateOpen();

      // Should not throw
      ws._simulateMessage(JSON.stringify({ type: "auth_ok", userId: "user-1" }));
      expect(throwingHandler).toHaveBeenCalled();
    });
  });
});
