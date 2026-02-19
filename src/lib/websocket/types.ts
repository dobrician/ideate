/**
 * WebSocket message types and protocol definitions.
 * All messages follow a discriminated union pattern via the `type` field.
 */

// ─── Client → Server Messages ───────────────────────────────────────

export interface WsAuthMessage {
  type: "auth";
  token: string;
}

export interface WsPingMessage {
  type: "ping";
}

export interface WsSubscribeMessage {
  type: "subscribe";
  channel: string;
}

export interface WsUnsubscribeMessage {
  type: "unsubscribe";
  channel: string;
}

export interface WsTypingMessage {
  type: "typing";
  channel: string;
}

export type WsClientMessage =
  | WsAuthMessage
  | WsPingMessage
  | WsSubscribeMessage
  | WsUnsubscribeMessage
  | WsTypingMessage;

// ─── Server → Client Messages ───────────────────────────────────────

export interface WsPongMessage {
  type: "pong";
}

export interface WsAuthOkMessage {
  type: "auth_ok";
  userId: string;
}

export interface WsAuthErrorMessage {
  type: "auth_error";
  reason: string;
}

export interface WsErrorMessage {
  type: "error";
  message: string;
}

export interface WsSubscribedMessage {
  type: "subscribed";
  channel: string;
}

export interface WsUnsubscribedMessage {
  type: "unsubscribed";
  channel: string;
}

/** Vote update broadcast */
export interface WsVoteUpdateMessage {
  type: "vote_update";
  channel: string;
  data: {
    proposalId: string;
    upvotes: number;
    downvotes: number;
  };
}

/** Presence update broadcast */
export interface WsPresenceMessage {
  type: "presence";
  channel: string;
  data: {
    userId: string;
    status: "online" | "offline";
    userName?: string;
  };
}

/** Typing indicator broadcast */
export interface WsTypingBroadcast {
  type: "typing_indicator";
  channel: string;
  data: {
    userId: string;
    userName?: string;
  };
}

/** Project change broadcast */
export interface WsProjectUpdateMessage {
  type: "project_update";
  channel: string;
  data: {
    action: "proposal_added" | "proposal_deleted" | "status_changed" | "vote_cast";
    entityId: string;
    summary: string;
    userId: string;
    userName?: string;
    timestamp: number;
  };
}

export type WsServerMessage =
  | WsPongMessage
  | WsAuthOkMessage
  | WsAuthErrorMessage
  | WsErrorMessage
  | WsSubscribedMessage
  | WsUnsubscribedMessage
  | WsVoteUpdateMessage
  | WsPresenceMessage
  | WsTypingBroadcast
  | WsProjectUpdateMessage;

// ─── Channel helpers ─────────────────────────────────────────────────

/** Parse a channel string into its type and id */
export function parseChannel(channel: string): { type: string; id: string } | null {
  const parts = channel.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { type: parts[0], id: parts[1] };
}

/** Valid channel prefixes */
export const CHANNEL_PREFIXES = ["project", "proposal"] as const;
export type ChannelPrefix = (typeof CHANNEL_PREFIXES)[number];

export function isValidChannel(channel: string): boolean {
  const parsed = parseChannel(channel);
  if (!parsed) return false;
  return (CHANNEL_PREFIXES as readonly string[]).includes(parsed.type);
}
