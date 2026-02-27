"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { WifiOff, RefreshCw, Check, AlertTriangle } from "lucide-react";
import { useLocale } from "@/lib/use-locale";
import { prefersReducedMotion } from "@/lib/a11y";

type SyncStatus = "idle" | "syncing" | "done" | "error";

export function OfflineIndicator() {
  const { t } = useLocale();
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");

  const triggerSync = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const { replayAll, getQueueSize } = await import("@/lib/offline/sync-engine");
      const results = await replayAll();
      const failures = results.filter((r) => !r.success && !r.conflict);
      const newStatus = failures.length > 0 ? "error" : "done";
      setSyncStatus(newStatus);
      const remaining = await getQueueSize();
      setPendingCount(remaining);
      if (newStatus !== "error") {
        setTimeout(() => setSyncStatus("idle"), 3000);
      }
    } catch {
      setSyncStatus("error");
    }
  }, []);

  // Store triggerSync in ref for stable event listener references
  const triggerSyncRef = useRef(triggerSync);
  triggerSyncRef.current = triggerSync;

  useEffect(() => {
    setOnline(navigator.onLine);

    const handleOnline = () => {
      setOnline(true);
      triggerSyncRef.current();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_REQUESTED") {
        triggerSyncRef.current();
      }
    };
    navigator.serviceWorker?.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener("message", handleMessage);
    };
  }, []);

  // Poll pending count
  useEffect(() => {
    async function checkPending() {
      try {
        const { getQueueSize } = await import("@/lib/offline/sync-engine");
        const count = await getQueueSize();
        setPendingCount(count);
      } catch {
        // IndexedDB not available
      }
    }
    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, []);

  if (online && pendingCount === 0 && syncStatus === "idle") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] left-4 z-40 flex items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-md text-sm"
    >
      {!online && (
        <>
          <WifiOff className="h-4 w-4 text-amber-500" aria-hidden="true" />
          <span className="text-amber-600 dark:text-amber-400">
            {t("offline.offline")}
          </span>
        </>
      )}
      {pendingCount > 0 && (
        <span className="text-muted-foreground">
          {t("offline.pendingActions").replace("{count}", String(pendingCount))}
        </span>
      )}
      {syncStatus === "syncing" && (
        <RefreshCw className={`h-4 w-4 text-blue-500 ${!prefersReducedMotion() ? "animate-spin" : ""}`} aria-hidden="true" />
      )}
      {syncStatus === "done" && (
        <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
      )}
      {syncStatus === "error" && (
        <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />
      )}
    </div>
  );
}
