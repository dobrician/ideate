"use client";

/**
 * WebSocket client library with reconnection, heartbeat, and message queuing.
 * Provides a reliable connection layer for real-time features.
 *
 * Usage:
 *   const client = createWsClient({ token: "jwt..." });
 *   client.subscribe("project:123", (msg) => console.log(msg));
 *   client.connect();
 *   // later:
 *   client.disconnect();
 */

import type { WsClientMessage, WsServerMessage } from "./types";

export type WsConnectionState = "disconnected" | "connecting" | "authenticating" | "connected";
export type WsMessageHandler = (message: WsServerMessage) => void;
export type WsStateChangeHandler = (state: WsConnectionState) => void;

export interface WsClientOptions {
  /** JWT session token for authentication */
  token: string;
  /** WebSocket URL (defaults to auto-detected from window.location) */
  url?: string;
  /** Heartbeat interval in ms (default: 25000) */
  heartbeatIntervalMs?: number;
  /** Max reconnect attempts (default: Infinity) */
  maxReconnectAttempts?: number;
  /** Initial reconnect delay in ms (default: 1000) */
  reconnectBaseMs?: number;
  /** Maximum reconnect delay in ms (default: 30000) */
  reconnectMaxMs?: number;
  /** Max queued messages while disconnected (default: 50) */
  maxQueueSize?: number;
}

export interface WsClient {
  /** Current connection state */
  readonly state: WsConnectionState;
  /** Connect to the WebSocket server */
  connect(): void;
  /** Disconnect and stop reconnection */
  disconnect(): void;
  /** Subscribe to a channel */
  subscribe(channel: string, handler: WsMessageHandler): () => void;
  /** Unsubscribe from a channel */
  unsubscribe(channel: string): void;
  /** Send a typed client message */
  sendMessage(message: WsClientMessage): void;
  /** Register a state change listener */
  onStateChange(handler: WsStateChangeHandler): () => void;
  /** Register a handler for all incoming messages */
  onMessage(handler: WsMessageHandler): () => void;
  /** Update the auth token (for token rotation) */
  updateToken(token: string): void;
}

const HEARTBEAT_INTERVAL_MS = 25_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const MAX_QUEUE_SIZE = 50;

function getDefaultWsUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:3000/api/ws";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/ws`;
}

export function createWsClient(options: WsClientOptions): WsClient {
  const {
    url = getDefaultWsUrl(),
    heartbeatIntervalMs = HEARTBEAT_INTERVAL_MS,
    maxReconnectAttempts = Infinity,
    reconnectBaseMs = RECONNECT_BASE_MS,
    reconnectMaxMs = RECONNECT_MAX_MS,
    maxQueueSize = MAX_QUEUE_SIZE,
  } = options;

  let token = options.token;
  let ws: WebSocket | null = null;
  let state: WsConnectionState = "disconnected";
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let intentionalClose = false;

  // Message queue for messages sent while disconnected
  const messageQueue: WsClientMessage[] = [];

  // Channel subscriptions: channel -> Set<handler>
  const channelHandlers = new Map<string, Set<WsMessageHandler>>();

  // Global message handlers
  const globalHandlers = new Set<WsMessageHandler>();

  // State change handlers
  const stateHandlers = new Set<WsStateChangeHandler>();

  function setState(newState: WsConnectionState): void {
    if (state === newState) return;
    state = newState;
    for (const handler of stateHandlers) {
      try {
        handler(newState);
      } catch {
        // handler errors shouldn't break the client
      }
    }
  }

  function rawSend(message: WsClientMessage): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function flushQueue(): void {
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift()!;
      rawSend(msg);
    }
  }

  function startHeartbeat(): void {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      rawSend({ type: "ping" });
    }, heartbeatIntervalMs);
  }

  function stopHeartbeat(): void {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function handleServerMessage(message: WsServerMessage): void {
    // Notify global handlers
    for (const handler of globalHandlers) {
      try {
        handler(message);
      } catch {
        // ignore
      }
    }

    switch (message.type) {
      case "auth_ok":
        setState("connected");
        reconnectAttempt = 0;
        startHeartbeat();
        // Re-subscribe to all channels
        for (const channel of channelHandlers.keys()) {
          rawSend({ type: "subscribe", channel });
        }
        flushQueue();
        break;

      case "auth_error":
        setState("disconnected");
        // Don't reconnect on auth errors
        intentionalClose = true;
        ws?.close();
        break;

      case "pong":
        // Heartbeat response, nothing to do
        break;

      case "subscribed":
      case "unsubscribed":
        // Confirmation, nothing to do
        break;

      default: {
        // Route channel messages to subscribers
        const channelMsg = message as { channel?: string };
        if (channelMsg.channel) {
          const handlers = channelHandlers.get(channelMsg.channel);
          if (handlers) {
            for (const handler of handlers) {
              try {
                handler(message);
              } catch {
                // ignore
              }
            }
          }
        }
        break;
      }
    }
  }

  function scheduleReconnect(): void {
    if (intentionalClose) return;
    if (reconnectAttempt >= maxReconnectAttempts) return;

    const delay = Math.min(
      reconnectBaseMs * Math.pow(2, reconnectAttempt),
      reconnectMaxMs,
    );
    reconnectAttempt++;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function connect(): void {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    intentionalClose = false;
    setState("connecting");

    try {
      ws = new WebSocket(url);
    } catch {
      setState("disconnected");
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      setState("authenticating");
      rawSend({ type: "auth", token });
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as WsServerMessage;
        handleServerMessage(message);
      } catch {
        // Invalid message, ignore
      }
    };

    ws.onclose = () => {
      stopHeartbeat();
      ws = null;
      if (state !== "disconnected") {
        setState("disconnected");
      }
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }

  function disconnect(): void {
    intentionalClose = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    stopHeartbeat();
    reconnectAttempt = 0;
    messageQueue.length = 0;

    if (ws) {
      ws.close(1000, "Client disconnect");
      ws = null;
    }
    setState("disconnected");
  }

  function sendMessage(message: WsClientMessage): void {
    if (state === "connected" && ws && ws.readyState === WebSocket.OPEN) {
      rawSend(message);
    } else {
      // Queue the message
      if (messageQueue.length < maxQueueSize) {
        messageQueue.push(message);
      }
    }
  }

  function subscribe(channel: string, handler: WsMessageHandler): () => void {
    let handlers = channelHandlers.get(channel);
    if (!handlers) {
      handlers = new Set();
      channelHandlers.set(channel, handlers);
      // Send subscribe if connected
      if (state === "connected") {
        rawSend({ type: "subscribe", channel });
      }
    }
    handlers.add(handler);

    return () => {
      handlers!.delete(handler);
      if (handlers!.size === 0) {
        channelHandlers.delete(channel);
        if (state === "connected") {
          rawSend({ type: "unsubscribe", channel });
        }
      }
    };
  }

  function unsubscribe(channel: string): void {
    channelHandlers.delete(channel);
    if (state === "connected") {
      rawSend({ type: "unsubscribe", channel });
    }
  }

  function onStateChange(handler: WsStateChangeHandler): () => void {
    stateHandlers.add(handler);
    return () => {
      stateHandlers.delete(handler);
    };
  }

  function onMessage(handler: WsMessageHandler): () => void {
    globalHandlers.add(handler);
    return () => {
      globalHandlers.delete(handler);
    };
  }

  function updateToken(newToken: string): void {
    token = newToken;
  }

  return {
    get state() {
      return state;
    },
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    sendMessage,
    onStateChange,
    onMessage,
    updateToken,
  };
}
