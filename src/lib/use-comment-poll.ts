"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Hook that polls for new comments by triggering a Next.js router refresh
 * at a fixed interval. The server component re-fetches comments on each
 * refresh, so new messages from other users appear automatically.
 *
 * Polling pauses when the tab is hidden (Page Visibility API) or when
 * `enabled` is false (e.g. when the discussion sheet is closed).
 */
export function useCommentPoll(intervalMs = 15_000, enabled = true) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      router.refresh();
    }, intervalMs);
  }, [router, intervalMs]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    start();

    function onVisibilityChange() {
      if (document.hidden) {
        stop();
      } else {
        router.refresh();
        start();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [start, stop, router, enabled]);
}
