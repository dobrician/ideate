"use client";

import { useMemo, useSyncExternalStore } from "react";
import { t as translate, type Locale } from "./i18n";

function getLocaleFromCookie(): Locale {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/(?:^|; )locale=([^;]*)/);
  const val = match ? decodeURIComponent(match[1]) : "en";
  return val === "ro" ? "ro" : "en";
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("languagechange", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("languagechange", cb);
  };
}

const serverLocale = (): Locale => "en";

/**
 * Client-side hook for translations.
 * Reads locale from cookie reactively via useSyncExternalStore.
 */
export function useLocale() {
  const locale = useSyncExternalStore(subscribe, getLocaleFromCookie, serverLocale);

  const t = useMemo(
    () =>
      (key: string, vars?: Record<string, string | number>) =>
        translate(locale, key, vars),
    [locale]
  );

  return { locale, t };
}
