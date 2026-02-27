"use client";

import { useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";

/**
 * Register the service worker on mount, handle updates and background sync.
 */
export function ServiceWorkerRegistration() {
  const { t } = useLocale();

  const handleUpdate = useCallback((registration: ServiceWorkerRegistration) => {
    const waitingWorker = registration.waiting;
    if (waitingWorker) {
      toast(t("pwa.updateAvailable"), {
        action: {
          label: t("pwa.updateNow"),
          onClick: () => {
            waitingWorker.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          },
        },
        duration: 15000,
      });
    }
  }, [t]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      // Check for updates periodically
      setInterval(() => registration.update(), 60 * 60 * 1000);

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            handleUpdate(registration);
          }
        });
      });

      // Request background sync registration
      if ("sync" in registration) {
        window.addEventListener("online", () => {
          (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
            .sync.register("offline-sync").catch(() => {});
        });
      }
    }).catch(() => {
      // Service worker registration failed silently
    });

    // Listen for controller changes (new SW took over)
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, [handleUpdate]);

  return null;
}
