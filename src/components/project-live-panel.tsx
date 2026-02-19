"use client";

/**
 * Live collaboration panel for a project page.
 * Connects to WebSocket, subscribes to the project channel,
 * and displays live participant count and activity feed.
 */

import { useEffect, useMemo } from "react";
import { createWsClient } from "@/lib/websocket/client";
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
  const channel = `project:${projectId}`;

  const client = useMemo(
    () => createWsClient({ token: sessionToken }),
    [sessionToken],
  );

  useEffect(() => {
    client.connect();
    return () => {
      client.disconnect();
    };
  }, [client]);

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
