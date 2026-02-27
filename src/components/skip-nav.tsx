"use client";

import { useLocale } from "@/lib/use-locale";

/**
 * Enhanced skip navigation links for keyboard users.
 * Visible only on focus, provides shortcuts to main content areas.
 */
export function SkipNav() {
  const { t } = useLocale();

  return (
    <div className="sr-only focus-within:not-sr-only focus-within:fixed focus-within:z-[100] focus-within:left-4 focus-within:top-4">
      <a
        href="#main-content"
        className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[44px] min-w-[44px] leading-[44px]"
      >
        {t("a11y.skipToMain")}
      </a>
    </div>
  );
}
