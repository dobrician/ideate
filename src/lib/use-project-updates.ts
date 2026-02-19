"use client";

/**
 * Hook for subscribing to real-time project updates via WebSocket.
 * Provides live activity feed data and participant count for a project channel.
 *
 * Usage:
 *   const { activities, participantCount } = useProjectUpdates(wsClient, "project:123");
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { WsClient } from "@/lib/websocket/client";
import type {
  WsServerMessage,
  WsProjectUpdateMessage,
  WsPresenceMessage,
} from "@/lib/websocket/types";

export interface ActivityItem {
  id: string;
  action: "proposal_added" | "proposal_deleted" | "status_changed" | "vote_cast";
  entityId: string;
  summary: string;
  userId: string;
  userName?: string;
  timestamp: number;
}

const MAX_ACTIVITY_ITEMS = 20;

/**
 * Hook that subscribes to project-level WebSocket updates.
 *
 * @param client - The WebSocket client instance (or null if not connected)
 * @param channel - The channel to subscribe to (e.g., "project:123")
 * @returns { activities, participantCount, clearActivities }
 */
export function useProjectUpdates(
  client: WsClient | null,
  channel: string,
) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const presenceMapRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!client) return;

    const unsub = client.subscribe(channel, (message: WsServerMessage) => {
      if (message.type === "project_update") {
        const update = message as WsProjectUpdateMessage;
        const item: ActivityItem = {
          id: `${update.data.timestamp}-${update.data.entityId}`,
          action: update.data.action,
          entityId: update.data.entityId,
          summary: update.data.summary,
          userId: update.data.userId,
          userName: update.data.userName,
          timestamp: update.data.timestamp,
        };
        setActivities((prev) => [item, ...prev].slice(0, MAX_ACTIVITY_ITEMS));
      }

      if (message.type === "presence") {
        const presence = message as WsPresenceMessage;
        const set = presenceMapRef.current;
        if (presence.data.status === "online") {
          set.add(presence.data.userId);
        } else {
          set.delete(presence.data.userId);
        }
        setParticipantCount(set.size);
      }
    });

    const set = presenceMapRef.current;
    return () => {
      unsub();
      set.clear();
      setParticipantCount(0);
    };
  }, [client, channel]);

  const clearActivities = useCallback(() => {
    setActivities([]);
  }, []);

  return { activities, participantCount, clearActivities };
}
