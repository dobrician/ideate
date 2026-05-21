"use client";

/**
 * Live collaboration panel for a project page.
 * Connects to WebSocket, subscribes to the project channel,
 * and displays live participant count and activity feed.
 * Falls back to polling mode when WebSocket connection fails.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createWsClient, type WsConnectionState } from "@/lib/websocket/client";
import { useProjectUpdates } from "@/lib/use-project-updates";
import { LiveParticipantCount } from "@/components/live-participant-count";
import { LiveActivityFeed } from "@/components/live-activity-feed";
import { useLocale } from "@/lib/use-locale";
import { Activity, WifiOff } from "lucide-react";

const POLLING_INTERVAL_MS = 15_000;
const FALLBACK_THRESHOLD_MS = 10_000;

/**
 * WebSocket upgrades require a custom Node server integration; the default
 * `next start` runtime can't handle the upgrade. When NEXT_PUBLIC_WS_ENABLED
 * is not "true" we skip the WS client entirely and rely on polling.
 */
const WS_ENABLED = process.env.NEXT_PUBLIC_WS_ENABLED === "true";

interface ProjectLivePanelProps {
  projectId: string;
  sessionToken: string;
}

export function ProjectLivePanel({ projectId, sessionToken }: ProjectLivePanelProps) {
  const { t } = useLocale();
  const router = useRouter();
  const channel = `project:${projectId}`;
  const [connectionState, setConnectionState] = useState<WsConnectionState>("disconnected");
  const [isPolling, setIsPolling] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const client = useMemo(
    () => createWsClient({ token: sessionToken }),
    [sessionToken],
  );

  const startPolling = useCallback(() => {
    if (pollingTimerRef.current) return;
    setIsPolling(true);
    pollingTimerRef.current = setInterval(() => {
      router.refresh();
    }, POLLING_INTERVAL_MS);
  }, [router]);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (!WS_ENABLED) {
      // No custom Node server in this deployment — go straight to polling.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time setup; setIsPolling(true) inside startPolling is the only way to signal polling mode.
      startPolling();
      return () => stopPolling();
    }

    const unsub = client.onStateChange((state: WsConnectionState) => {
      setConnectionState(state);

      if (state === "connected") {
        // Clear fallback timer and stop polling on successful connection
        if (fallbackTimerRef.current) {
          clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        stopPolling();
      } else if (state === "disconnected") {
        // Start fallback timer — if still disconnected after threshold, switch to polling
        if (!fallbackTimerRef.current) {
          fallbackTimerRef.current = setTimeout(() => {
            fallbackTimerRef.current = null;
            startPolling();
          }, FALLBACK_THRESHOLD_MS);
        }
      }
    });

    client.connect();

    return () => {
      unsub();
      client.disconnect();
      stopPolling();
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [client, startPolling, stopPolling]);

  const { activities, participantCount } = useProjectUpdates(client, channel);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <LiveParticipantCount count={participantCount} />
        {isPolling && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <WifiOff className="h-3 w-3" />
            {t("ws.fallbackPolling")}
          </span>
        )}
      </div>
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
