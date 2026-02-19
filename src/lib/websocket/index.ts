/**
 * WebSocket barrel export.
 * Re-exports types and key functions for convenience.
 */

export type {
  WsClientMessage,
  WsServerMessage,
  WsVoteUpdateMessage,
  WsPresenceMessage,
  WsTypingBroadcast,
  WsProjectUpdateMessage,
} from "./types";

export { isValidChannel, parseChannel, CHANNEL_PREFIXES } from "./types";

export {
  getWss,
  handleUpgrade,
  closeWss,
  broadcastToChannel,
  publishToChannel,
  getConnectionCount,
  getAuthenticatedCount,
  getUserConnectionCount,
  getChannelSubscriberCount,
  getConnectionStats,
} from "./server";

export { createWsClient } from "./client";
export type { WsClient, WsClientOptions, WsConnectionState, WsMessageHandler, WsStateChangeHandler } from "./client";
