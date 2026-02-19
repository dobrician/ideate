"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { t as translate, type Locale } from "./i18n";

const LocaleContext = createContext<Locale>("en");

/**
 * Provider that passes the server-detected locale to client components,
 * eliminating hydration mismatch between SSR and client rendering.
 */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

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

/**
 * Client-side hook for translations.
 * Uses server-provided locale as the SSR snapshot (via context),
 * then reads from cookie on the client for reactivity.
 * This eliminates the hydration mismatch that caused duplicate DOM elements.
 */
export function useLocale() {
  const serverLocale = useContext(LocaleContext);
  const locale = useSyncExternalStore(
    subscribe,
    getLocaleFromCookie,
    () => serverLocale
  );

  const t = useMemo(
    () =>
      (key: string, vars?: Record<string, string | number>) =>
        translate(locale, key, vars),
    [locale]
  );

  return { locale, t };
}
