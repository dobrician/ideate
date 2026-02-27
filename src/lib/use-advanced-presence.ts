"use client";

import { useCallback, useEffect, useState } from "react";
import type { WsClient } from "@/lib/websocket/client";

export type ActivityStatus = "editing" | "reviewing" | "typing" | "idle" | "online" | "offline";

export interface PresenceUser {
  userId: string;
  userName?: string;
  activity: ActivityStatus;
  lastSeen: number;
}

const PRESENCE_EXPIRY_MS = 30_000;
const VALID_ACTIVITIES = new Set<ActivityStatus>(["editing", "reviewing", "typing", "idle", "online", "offline"]);

/**
 * Enhanced presence hook with detailed activity states.
 * Tracks editing, reviewing, typing, and idle states for all users in a channel.
 */
export function useAdvancedPresence(
  client: WsClient | null,
  channel: string,
) {
  const [users, setUsers] = useState<Map<string, PresenceUser>>(new Map());

  // Handle incoming messages
  useEffect(() => {
    if (!client) return;

    const unsubscribe = client.onMessage((msg) => {
      const data = typeof msg === "string" ? JSON.parse(msg) : msg;

      if (data.type === "presence" && data.channel === channel) {
        setUsers(prev => {
          const next = new Map(prev);
          if (data.data.status === "offline") {
            next.delete(data.data.userId);
          } else {
            next.set(data.data.userId, {
              userId: data.data.userId,
              userName: data.data.userName,
              activity: "online",
              lastSeen: Date.now(),
            });
          }
          return next;
        });
      }

      if (data.type === "activity_broadcast" && data.channel === channel) {
        if (!VALID_ACTIVITIES.has(data.activity)) return;
        setUsers(prev => {
          const next = new Map(prev);
          const existing = next.get(data.userId);
          next.set(data.userId, {
            userId: data.userId,
            userName: data.userName ?? existing?.userName,
            activity: data.activity as ActivityStatus,
            lastSeen: Date.now(),
          });
          return next;
        });
      }

      if (data.type === "typing_indicator" && data.channel === channel) {
        setUsers(prev => {
          const next = new Map(prev);
          const existing = next.get(data.data.userId);
          next.set(data.data.userId, {
            userId: data.data.userId,
            userName: data.data.userName ?? existing?.userName,
            activity: "typing",
            lastSeen: Date.now(),
          });
          return next;
        });
      }
    });

    return unsubscribe;
  }, [client, channel]);

  // Expire stale presence entries
  useEffect(() => {
    const interval = setInterval(() => {
      setUsers(prev => {
        const now = Date.now();
        let changed = false;
        const next = new Map(prev);
        for (const [key, user] of next) {
          if (now - user.lastSeen > PRESENCE_EXPIRY_MS) {
            next.delete(key);
            changed = true;
          } else if (user.activity === "typing" && now - user.lastSeen > 5000) {
            // Typing expires after 5s
            next.set(key, { ...user, activity: "online" });
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const activeEditors = Array.from(users.values()).filter(u => u.activity === "editing");
  const viewers = Array.from(users.values()).filter(u => u.activity !== "editing" && u.activity !== "offline");

  return {
    users: Array.from(users.values()),
    activeEditors,
    viewers,
    participantCount: users.size,
  };
}
