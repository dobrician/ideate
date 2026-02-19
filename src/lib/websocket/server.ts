/**
 * WebSocket server module.
 * Manages authenticated connections, channel subscriptions, and message routing.
 * Uses the `ws` library with JWT authentication.
 *
 * This module is designed to work alongside the existing SSE fallback.
 * Connections authenticate via a JWT token sent as the first message.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { verifySessionToken } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getPubSub } from "@/lib/pubsub";
import { setPresence, removePresence, removeAllPresence } from "@/lib/presence";
import type {
  WsClientMessage,
  WsServerMessage,
} from "./types";
import { isValidChannel } from "./types";

const HEARTBEAT_INTERVAL_MS = 30_000;
const AUTH_TIMEOUT_MS = 10_000;
const MAX_CONNECTIONS_PER_USER = 5;

interface ClientState {
  userId: string | null;
  email: string | null;
  userName?: string;
  channels: Set<string>;
  alive: boolean;
  authTimer: ReturnType<typeof setTimeout> | null;
  unsubscribers: Map<string, () => void>;
}

// ─── Connection tracking ─────────────────────────────────────────────

const clients = new Map<WebSocket, ClientState>();
const userConnectionCounts = new Map<string, number>();

export function getConnectionCount(): number {
  return clients.size;
}

export function getAuthenticatedCount(): number {
  let count = 0;
  for (const state of clients.values()) {
    if (state.userId) count++;
  }
  return count;
}

export function getUserConnectionCount(userId: string): number {
  return userConnectionCounts.get(userId) ?? 0;
}

export function getChannelSubscriberCount(channel: string): number {
  let count = 0;
  for (const state of clients.values()) {
    if (state.channels.has(channel)) count++;
  }
  return count;
}

export function getConnectionStats(): {
  total: number;
  authenticated: number;
  channels: Record<string, number>;
} {
  const channels: Record<string, number> = {};
  let authenticated = 0;
  for (const state of clients.values()) {
    if (state.userId) authenticated++;
    for (const ch of state.channels) {
      channels[ch] = (channels[ch] ?? 0) + 1;
    }
  }
  return { total: clients.size, authenticated, channels };
}

// ─── Message helpers ─────────────────────────────────────────────────

function send(ws: WebSocket, message: WsServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/** Broadcast a message to all authenticated clients subscribed to a channel */
export function broadcastToChannel(channel: string, message: WsServerMessage): void {
  for (const [ws, state] of clients) {
    if (state.userId && state.channels.has(channel)) {
      send(ws, message);
    }
  }
}

// ─── Client message handler ─────────────────────────────────────────

function handleMessage(ws: WebSocket, state: ClientState, raw: string): void {
  let msg: WsClientMessage;
  try {
    msg = JSON.parse(raw) as WsClientMessage;
  } catch {
    send(ws, { type: "error", message: "Invalid JSON" });
    return;
  }

  if (!msg || typeof msg.type !== "string") {
    send(ws, { type: "error", message: "Missing message type" });
    return;
  }

  switch (msg.type) {
    case "auth":
      handleAuth(ws, state, msg.token);
      break;

    case "ping":
      send(ws, { type: "pong" });
      break;

    case "subscribe":
      handleSubscribe(ws, state, msg.channel);
      break;

    case "unsubscribe":
      handleUnsubscribe(ws, state, msg.channel);
      break;

    case "typing":
      handleTyping(ws, state, msg.channel);
      break;

    default:
      send(ws, { type: "error", message: "Unknown message type" });
  }
}

function handleAuth(ws: WebSocket, state: ClientState, token: string): void {
  if (state.userId) {
    send(ws, { type: "error", message: "Already authenticated" });
    return;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    send(ws, { type: "auth_error", reason: "Invalid or expired token" });
    ws.close(4001, "Authentication failed");
    return;
  }

  // Check connection limit
  const currentCount = userConnectionCounts.get(payload.userId) ?? 0;
  if (currentCount >= MAX_CONNECTIONS_PER_USER) {
    send(ws, { type: "auth_error", reason: "Too many connections" });
    ws.close(4002, "Connection limit exceeded");
    return;
  }

  // Clear auth timeout
  if (state.authTimer) {
    clearTimeout(state.authTimer);
    state.authTimer = null;
  }

  state.userId = payload.userId;
  state.email = payload.email;
  userConnectionCounts.set(payload.userId, currentCount + 1);

  send(ws, { type: "auth_ok", userId: payload.userId });
}

function handleSubscribe(ws: WebSocket, state: ClientState, channel: string): void {
  if (!state.userId) {
    send(ws, { type: "error", message: "Not authenticated" });
    return;
  }

  if (!isValidChannel(channel)) {
    send(ws, { type: "error", message: "Invalid channel format" });
    return;
  }

  if (state.channels.has(channel)) {
    send(ws, { type: "subscribed", channel });
    return;
  }

  state.channels.add(channel);

  // Subscribe to pub/sub for cross-instance delivery
  const pubsub = getPubSub();
  const unsub = pubsub.subscribe(`ws:${channel}`, (_ch, message) => {
    try {
      const parsed = JSON.parse(message) as WsServerMessage;
      send(ws, parsed);
    } catch {
      // ignore malformed pubsub messages
    }
  });
  state.unsubscribers.set(channel, unsub);

  // Set presence for this user in the channel
  setPresence(channel, state.userId, state.userName).catch(() => {});

  send(ws, { type: "subscribed", channel });
}

function handleUnsubscribe(ws: WebSocket, state: ClientState, channel: string): void {
  if (!state.userId) {
    send(ws, { type: "error", message: "Not authenticated" });
    return;
  }

  // Remove presence for this user from the channel
  removePresence(channel, state.userId, state.userName).catch(() => {});

  state.channels.delete(channel);
  const unsub = state.unsubscribers.get(channel);
  if (unsub) {
    unsub();
    state.unsubscribers.delete(channel);
  }

  send(ws, { type: "unsubscribed", channel });
}

function handleTyping(ws: WebSocket, state: ClientState, channel: string): void {
  if (!state.userId) {
    send(ws, { type: "error", message: "Not authenticated" });
    return;
  }

  if (!state.channels.has(channel)) {
    return; // silently ignore typing for unsubscribed channels
  }

  // Broadcast typing to other subscribers on same channel
  const typingMsg: WsServerMessage = {
    type: "typing_indicator",
    channel,
    data: {
      userId: state.userId,
      userName: state.userName,
    },
  };

  // Broadcast to local clients
  for (const [clientWs, clientState] of clients) {
    if (clientWs !== ws && clientState.userId && clientState.channels.has(channel)) {
      send(clientWs, typingMsg);
    }
  }

  // Publish to pub/sub for cross-instance
  const pubsub = getPubSub();
  pubsub.publish(`ws:${channel}`, JSON.stringify(typingMsg));
}

// ─── Connection lifecycle ────────────────────────────────────────────

function cleanupClient(ws: WebSocket): void {
  const state = clients.get(ws);
  if (!state) return;

  // Clear auth timer
  if (state.authTimer) {
    clearTimeout(state.authTimer);
  }

  // Unsubscribe from all pub/sub channels
  for (const unsub of state.unsubscribers.values()) {
    unsub();
  }

  // Remove presence from all channels
  if (state.userId) {
    for (const channel of state.channels) {
      removePresence(channel, state.userId, state.userName).catch(() => {});
    }
  }

  // Decrement user connection count
  if (state.userId) {
    const count = userConnectionCounts.get(state.userId) ?? 1;
    if (count <= 1) {
      userConnectionCounts.delete(state.userId);
      // Remove all presence when last connection closes
      removeAllPresence(state.userId, state.userName).catch(() => {});
    } else {
      userConnectionCounts.set(state.userId, count - 1);
    }
  }

  clients.delete(ws);
}

function onConnection(ws: WebSocket): void {
  const state: ClientState = {
    userId: null,
    email: null,
    channels: new Set(),
    alive: true,
    authTimer: null,
    unsubscribers: new Map(),
  };

  clients.set(ws, state);

  // Require authentication within timeout
  state.authTimer = setTimeout(() => {
    if (!state.userId) {
      send(ws, { type: "auth_error", reason: "Authentication timeout" });
      ws.close(4000, "Authentication timeout");
    }
  }, AUTH_TIMEOUT_MS);

  ws.on("message", (data) => {
    state.alive = true;
    try {
      const raw = typeof data === "string" ? data : data.toString("utf-8");
      handleMessage(ws, state, raw);
    } catch (err) {
      logger.warn({ err }, "WebSocket message handling error");
      send(ws, { type: "error", message: "Internal error" });
    }
  });

  ws.on("close", () => {
    cleanupClient(ws);
  });

  ws.on("error", (err) => {
    logger.warn({ err: err.message }, "WebSocket client error");
    cleanupClient(ws);
  });

  ws.on("pong", () => {
    state.alive = true;
  });
}

// ─── WebSocket Server singleton ──────────────────────────────────────

let wss: WebSocketServer | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Get or create the WebSocket server.
 * Uses noServer mode so upgrades are handled manually.
 */
export function getWss(): WebSocketServer {
  if (wss) return wss;

  wss = new WebSocketServer({ noServer: true });
  wss.on("connection", onConnection);

  // Start heartbeat interval
  heartbeatInterval = setInterval(() => {
    for (const [ws, state] of clients) {
      if (!state.alive) {
        ws.terminate();
        cleanupClient(ws);
        continue;
      }
      state.alive = false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  logger.info("WebSocket server initialized");
  return wss;
}

/**
 * Handle an HTTP upgrade request for WebSocket.
 */
export function handleUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
): void {
  const server = getWss();
  server.handleUpgrade(req, socket, head, (ws) => {
    server.emit("connection", ws, req);
  });
}

/**
 * Gracefully shut down the WebSocket server.
 */
export function closeWss(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (wss) {
    for (const ws of clients.keys()) {
      ws.close(1001, "Server shutting down");
    }
    clients.clear();
    userConnectionCounts.clear();
    wss.close();
    wss = null;
  }
}

/**
 * Publish a message to a channel via pub/sub (cross-instance).
 * Used by server-side code to broadcast to all WebSocket clients.
 */
export function publishToChannel(channel: string, message: WsServerMessage): void {
  // Deliver locally
  broadcastToChannel(channel, message);

  // Publish to pub/sub for other instances
  const pubsub = getPubSub();
  pubsub.publish(`ws:${channel}`, JSON.stringify(message));
}
