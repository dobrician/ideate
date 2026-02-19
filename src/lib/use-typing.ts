"use client";

/**
 * Typing indicator hook for real-time collaboration.
 * Tracks who is currently typing in a channel via WebSocket.
 *
 * Usage:
 *   const { typingUsers, sendTyping } = useTypingIndicator(wsClient, "project:123");
 *   // Call sendTyping() when user types
 *   // typingUsers is an array of { userId, userName } currently typing
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { WsClient } from "@/lib/websocket/client";
import type { WsServerMessage, WsTypingBroadcast } from "@/lib/websocket/types";

export interface TypingUser {
  userId: string;
  userName?: string;
}

const TYPING_DEBOUNCE_MS = 2_000;
const TYPING_EXPIRY_MS = 5_000;

interface TypingEntry {
  userId: string;
  userName?: string;
  expiresAt: number;
}

/**
 * Hook that manages typing indicators for a specific channel.
 *
 * @param client - The WebSocket client instance (or null if not connected)
 * @param channel - The channel to track typing in (e.g., "project:123")
 * @returns { typingUsers, sendTyping }
 */
export function useTypingIndicator(
  client: WsClient | null,
  channel: string,
) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingMapRef = useRef<Map<string, TypingEntry>>(new Map());
  const cleanupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentRef = useRef<number>(0);

  // Cleanup expired entries
  useEffect(() => {
    cleanupTimerRef.current = setInterval(() => {
      const now = Date.now();
      const map = typingMapRef.current;
      let changed = false;

      for (const [userId, entry] of map) {
        if (now >= entry.expiresAt) {
          map.delete(userId);
          changed = true;
        }
      }

      if (changed) {
        setTypingUsers(
          Array.from(map.values()).map((e) => ({
            userId: e.userId,
            userName: e.userName,
          })),
        );
      }
    }, 1_000);

    return () => {
      if (cleanupTimerRef.current) {
        clearInterval(cleanupTimerRef.current);
      }
    };
  }, []);

  // Listen for typing events from the WebSocket
  useEffect(() => {
    if (!client) return;

    const unsub = client.onMessage((message: WsServerMessage) => {
      if (message.type !== "typing_indicator") return;
      const typingMsg = message as WsTypingBroadcast;
      if (typingMsg.channel !== channel) return;

      const { userId, userName } = typingMsg.data;
      const map = typingMapRef.current;

      map.set(userId, {
        userId,
        userName,
        expiresAt: Date.now() + TYPING_EXPIRY_MS,
      });

      setTypingUsers(
        Array.from(map.values()).map((e) => ({
          userId: e.userId,
          userName: e.userName,
        })),
      );
    });

    const mapRef = typingMapRef.current;
    return () => {
      unsub();
      // Clear typing state when channel changes or component unmounts
      mapRef.clear();
      lastSentRef.current = 0;
    };
  }, [client, channel]);

  // Send typing indicator with debounce
  const sendTyping = useCallback(() => {
    if (!client || client.state !== "connected") return;

    const now = Date.now();
    if (now - lastSentRef.current < TYPING_DEBOUNCE_MS) return;

    lastSentRef.current = now;
    client.sendMessage({ type: "typing", channel });
  }, [client, channel]);

  return { typingUsers, sendTyping };
}
