"use client";

/**
 * Live collaboration panel for a project page.
 * Connects to WebSocket, subscribes to the project channel,
 * without displaying connection details or an activity panel.
 * Falls back to polling mode when WebSocket connection fails.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createWsClient, type WsConnectionState } from "@/lib/websocket/client";
import { useProjectUpdates } from "@/lib/use-project-updates";

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

/** Refresh project data in the background without visible technical chrome. */
export function ProjectLivePanel({ projectId, sessionToken }: ProjectLivePanelProps) {
  const router = useRouter();
  const channel = `project:${projectId}`;
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const client = useMemo(
    () => createWsClient({ token: sessionToken }),
    [sessionToken],
  );

  const startPolling = useCallback(() => {
    if (pollingTimerRef.current) return;
    pollingTimerRef.current = setInterval(() => {
      router.refresh();
    }, POLLING_INTERVAL_MS);
  }, [router]);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!WS_ENABLED) {
      // No custom Node server in this deployment — go straight to polling.
      startPolling();
      return () => stopPolling();
    }

    const unsub = client.onStateChange((state: WsConnectionState) => {
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

  useProjectUpdates(client, channel);

  return null;
}
