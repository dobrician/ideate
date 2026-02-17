"use client";

import { useEffect, useRef, useState } from "react";

interface VoteUpdate {
  proposalId: string;
  upvotes: number;
  downvotes: number;
}

const BACKOFF_INITIAL_MS = 1000;
const BACKOFF_MAX_MS = 30000;

/**
 * Hook that subscribes to real-time vote updates via SSE.
 * Returns a map of proposalId -> { upvotes, downvotes }.
 * Reconnects with exponential backoff (1s -> 2s -> 4s ... cap 30s), resets on success.
 */
export function useVoteStream(projectId: string) {
  const [updates, setUpdates] = useState<Map<string, VoteUpdate>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(BACKOFF_INITIAL_MS);

  useEffect(() => {
    function connect() {
      if (eventSourceRef.current) return;

      const es = new EventSource(`/api/votes/stream?projectId=${projectId}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as VoteUpdate;
          backoffRef.current = BACKOFF_INITIAL_MS;
          setUpdates((prev) => {
            const next = new Map(prev);
            next.set(data.proposalId, data);
            return next;
          });
        } catch {
          // Invalid data, ignore
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, BACKOFF_MAX_MS);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      backoffRef.current = BACKOFF_INITIAL_MS;
    };
  }, [projectId]);

  return updates;
}
