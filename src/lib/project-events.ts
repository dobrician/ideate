/**
 * Project event broadcaster.
 * Publishes project-level changes (new proposals, status changes, votes)
 * through the WebSocket channel system for real-time updates.
 */

import { publishToChannel } from "@/lib/websocket/server";
import type { WsProjectUpdateMessage } from "@/lib/websocket/types";

export interface ProjectEvent {
  projectId: string;
  action: "proposal_added" | "proposal_deleted" | "status_changed" | "vote_cast";
  entityId: string;
  summary: string;
  userId: string;
  userName?: string;
}

/**
 * Emit a project-level event to all WebSocket subscribers.
 */
export function emitProjectEvent(event: ProjectEvent): void {
  const channel = `project:${event.projectId}`;
  const message: WsProjectUpdateMessage = {
    type: "project_update",
    channel,
    data: {
      action: event.action,
      entityId: event.entityId,
      summary: event.summary,
      userId: event.userId,
      userName: event.userName,
      timestamp: Date.now(),
    },
  };

  try {
    publishToChannel(channel, message);
  } catch {
    // WebSocket server may not be initialized
  }
}
