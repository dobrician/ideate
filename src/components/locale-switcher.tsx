"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

type Locale = "en" | "ro";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function setCookie(name: string, value: string, days = 365): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getLocale(): Locale {
  const stored = getCookie("locale");
  return stored === "ro" ? "ro" : "en";
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

/**
 * Locale switcher button (EN/RO toggle)
 */
export function LocaleSwitcher() {
  const locale = useSyncExternalStore(subscribe, getLocale, () => "en" as Locale);

  const toggle = useCallback(() => {
    const next: Locale = locale === "en" ? "ro" : "en";
    setCookie("locale", next);
    window.location.reload();
  }, [locale]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="gap-1 text-xs font-medium"
      title={locale === "en" ? "Switch to Romanian" : "Switch to English"}
    >
      <Globe className="h-3.5 w-3.5" />
      {locale.toUpperCase()}
    </Button>
  );
}
