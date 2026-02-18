"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useLocale } from "@/lib/use-locale";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";

/**
 * PWA install prompt banner — shows once per session
 */
export function PwaInstall() {
  const { t } = useLocale();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(DISMISSED_KEY) === "1";
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
    dismiss();
  }

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-lg border bg-background p-3 shadow-lg sm:left-auto sm:right-4">
      <div className="flex-1">
        <p className="text-sm font-medium">{t("pwa.install")}</p>
        <p className="text-xs text-muted-foreground">
          {t("pwa.installDesc")}
        </p>
      </div>
      <Button size="sm" onClick={handleInstall}>
        <Download className="mr-1 h-3 w-3" />
        {t("pwa.installButton")}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 min-h-[40px] min-w-[40px]"
        onClick={dismiss}
        aria-label={t("pwa.dismiss")}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
