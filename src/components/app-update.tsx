"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/use-locale";

/**
 * Detects service worker updates and prompts user to refresh.
 */
export function AppUpdate() {
  const { t } = useLocale();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg);

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      });
    });
  }, []);

  const handleUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    window.location.reload();
  }, [registration]);

  if (!updateAvailable) return null;

  return (
    <div
      role="alert"
      className="fixed top-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg"
    >
      <RefreshCw className="h-4 w-4 text-primary" aria-hidden="true" />
      <span className="text-sm">{t("pwa.updateAvailable")}</span>
      <Button size="sm" onClick={handleUpdate} className="min-h-[44px]">
        {t("pwa.updateNow")}
      </Button>
    </div>
  );
}
