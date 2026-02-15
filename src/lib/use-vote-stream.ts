"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface VoteUpdate {
  proposalId: string;
  upvotes: number;
  downvotes: number;
}

/**
 * Hook that subscribes to real-time vote updates via SSE.
 * Returns a map of proposalId -> { upvotes, downvotes }.
 */
export function useVoteStream(projectId: string) {
  const [updates, setUpdates] = useState<Map<string, VoteUpdate>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) return;

    const es = new EventSource(`/api/votes/stream?projectId=${projectId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as VoteUpdate;
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
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };
  }, [projectId]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [connect]);

  return updates;
}
