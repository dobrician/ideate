"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createFromDiff, transform, apply, type TextOperation } from "@/lib/ot";
import type { WsClient } from "@/lib/websocket/client";

export interface RemoteCursor {
  userId: string;
  userName?: string;
  position: number;
  selectionEnd?: number;
  lastSeen: number;
}

interface CollabState {
  /** Current document content */
  text: string;
  /** Server-acknowledged revision */
  revision: number;
  /** Pending operation waiting for ack */
  pending: TextOperation | null;
  /** Buffer of local changes since last ack */
  buffer: TextOperation | null;
}

const CURSOR_EXPIRY_MS = 10_000;
const CURSOR_SEND_INTERVAL_MS = 500;

/**
 * Hook for collaborative text editing using OT over WebSocket.
 *
 * Manages local edits, syncs with remote changes, and provides cursor tracking.
 */
export function useCollaborativeEdit(
  client: WsClient | null,
  channel: string,
  docId: string,
  initialText: string,
  initialRevision: number = 0,
) {
  const stateRef = useRef<CollabState>({
    text: initialText,
    revision: initialRevision,
    pending: null,
    buffer: null,
  });
  const [text, setText] = useState(initialText);
  const [revision, setRevision] = useState(initialRevision);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const lastCursorSent = useRef(0);

  // Send operation to server
  const sendOp = useCallback((op: TextOperation) => {
    if (!client) return;
    client.sendMessage({
      type: "edit",
      channel,
      docId,
      operation: JSON.stringify(op),
      revision: stateRef.current.revision,
    });
  }, [client, channel, docId]);

  // Handle local text change
  const handleChange = useCallback((newText: string) => {
    const state = stateRef.current;
    const op = createFromDiff(state.text, newText);
    if (op.ops.length === 0) return;

    state.text = newText;
    setText(newText);

    if (state.pending) {
      // Already waiting for ack; buffer this change
      if (state.buffer) {
        try {
          const { compose } = require("@/lib/ot");
          state.buffer = compose(state.buffer, op);
        } catch {
          state.buffer = op;
        }
      } else {
        state.buffer = op;
      }
    } else {
      // Send immediately
      state.pending = op;
      sendOp(op);
    }
  }, [sendOp]);

  // Send cursor position (throttled)
  const sendCursor = useCallback((position: number, selectionEnd?: number) => {
    if (!client) return;
    const now = Date.now();
    if (now - lastCursorSent.current < CURSOR_SEND_INTERVAL_MS) return;
    lastCursorSent.current = now;
    client.sendMessage({
      type: "cursor",
      channel,
      docId,
      position,
      selectionEnd,
    });
  }, [client, channel, docId]);

  // Send activity status
  const sendActivity = useCallback((activity: "editing" | "reviewing" | "idle") => {
    if (!client) return;
    client.sendMessage({
      type: "activity",
      channel,
      activity,
    });
  }, [client, channel]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!client) return;

    const unsubscribe = client.onMessage((msg) => {
      const data = typeof msg === "string" ? JSON.parse(msg) : msg;

      if (data.type === "edit_ack" && data.docId === docId) {
        const state = stateRef.current;
        state.revision = data.revision;
        setRevision(data.revision);
        state.pending = null;

        // Send buffered operation if any
        if (state.buffer) {
          state.pending = state.buffer;
          state.buffer = null;
          sendOp(state.pending);
        }
      }

      if (data.type === "edit_broadcast" && data.docId === docId) {
        const state = stateRef.current;
        try {
          const remoteOp = JSON.parse(data.operation) as TextOperation;
          let transformedOp = remoteOp;

          // Transform against pending operations
          if (state.pending) {
            const [newPending, newRemote] = transform(state.pending, remoteOp);
            state.pending = newPending;
            transformedOp = newRemote;
          }
          if (state.buffer) {
            const [newBuffer, newRemote] = transform(state.buffer, transformedOp);
            state.buffer = newBuffer;
            transformedOp = newRemote;
          }

          state.text = apply(state.text, transformedOp);
          state.revision = data.revision;
          setRevision(data.revision);
          setText(state.text);
        } catch {
          // OT error — could request full sync
        }
      }

      if (data.type === "cursor_broadcast" && data.docId === docId) {
        setRemoteCursors(prev => {
          const next = new Map(prev);
          next.set(data.userId, {
            userId: data.userId,
            userName: data.userName,
            position: data.position,
            selectionEnd: data.selectionEnd,
            lastSeen: Date.now(),
          });
          return next;
        });
      }
    });

    const stateUnsub = client.onStateChange((state) => {
      setIsConnected(state === "connected");
    });

    return () => {
      unsubscribe();
      stateUnsub();
    };
  }, [client, docId, sendOp]);

  // Cleanup expired cursors
  useEffect(() => {
    const interval = setInterval(() => {
      setRemoteCursors(prev => {
        const now = Date.now();
        let changed = false;
        const next = new Map(prev);
        for (const [key, cursor] of next) {
          if (now - cursor.lastSeen > CURSOR_EXPIRY_MS) {
            next.delete(key);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return {
    text,
    setText: handleChange,
    remoteCursors,
    sendCursor,
    sendActivity,
    isConnected,
    revision,
  };
}
