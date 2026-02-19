"use client";

/**
 * Live collaboration panel for a project page.
 * Connects to WebSocket, subscribes to the project channel,
 * and displays live participant count and activity feed.
 */

import { useEffect, useRef, useState } from "react";
import { createWsClient, type WsClient } from "@/lib/websocket/client";
import { useProjectUpdates } from "@/lib/use-project-updates";
import { LiveParticipantCount } from "@/components/live-participant-count";
import { LiveActivityFeed } from "@/components/live-activity-feed";
import { useLocale } from "@/lib/use-locale";
import { Activity } from "lucide-react";

interface ProjectLivePanelProps {
  projectId: string;
  sessionToken: string;
}

export function ProjectLivePanel({ projectId, sessionToken }: ProjectLivePanelProps) {
  const { t } = useLocale();
  const [client, setClient] = useState<WsClient | null>(null);
  const clientRef = useRef<WsClient | null>(null);
  const channel = `project:${projectId}`;

  useEffect(() => {
    const ws = createWsClient({ token: sessionToken });
    clientRef.current = ws;
    setClient(ws);
    ws.connect();

    return () => {
      ws.disconnect();
      clientRef.current = null;
    };
  }, [sessionToken]);

  const { activities, participantCount } = useProjectUpdates(client, channel);

  return (
    <div className="space-y-3">
      <LiveParticipantCount count={participantCount} />
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          {t("live.activityFeed")}
        </h3>
        <LiveActivityFeed activities={activities} />
      </div>
    </div>
  );
}
