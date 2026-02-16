"use client";

import { useMemo } from "react";
import { t as translate, type Locale } from "./i18n";

function getLocaleFromCookie(): Locale {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/(?:^|; )locale=([^;]*)/);
  const val = match ? decodeURIComponent(match[1]) : "en";
  return val === "ro" ? "ro" : "en";
}

/**
 * Client-side hook for translations.
 * Reads locale from cookie.
 */
export function useLocale() {
  const locale = getLocaleFromCookie();

  const t = useMemo(
    () =>
      (key: string, vars?: Record<string, string | number>) =>
        translate(locale, key, vars),
    [locale]
  );

  return { locale, t };
}
