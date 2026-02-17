import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date with locale-aware formatting.
 * @param date  - Date value (string, number, or Date)
 * @param locale - "en" or "ro"
 * @param style  - "long" for "February 16, 2026", "short" for "Feb 16, 2026", "default" for locale default
 */
export function formatDate(
  date: string | number | Date | null | undefined,
  locale: string,
  style: "long" | "short" | "default" = "long",
): string {
  if (!date) return "";
  const dateFmt = locale === "ro" ? "ro-RO" : "en-US";
  const options: Intl.DateTimeFormatOptions | undefined =
    style === "long"
      ? { year: "numeric", month: "long", day: "numeric" }
      : style === "short"
        ? { year: "numeric", month: "short", day: "numeric" }
        : undefined;
  return new Date(date).toLocaleDateString(dateFmt, options);
}

/**
 * Format a date-time with locale-aware formatting.
 */
export function formatDateTime(
  date: string | number | Date | null | undefined,
  locale: string,
): string {
  if (!date) return "";
  const dateFmt = locale === "ro" ? "ro-RO" : "en-US";
  return new Date(date).toLocaleString(dateFmt);
}

/**
 * Format a date as a relative time string ("2h ago", "3d ago").
 * Falls back to short date for anything older than 30 days.
 */
export function formatRelativeTime(
  date: string | number | Date | null | undefined,
  locale: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (!date) return "";
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t("time.minutesAgo", { count: 1 });
  if (diffMins < 60) return t("time.minutesAgo", { count: diffMins });
  if (diffHours < 24) return t("time.hoursAgo", { count: diffHours });
  if (diffDays <= 30) return t("time.daysAgo", { count: diffDays });
  return formatDate(date, locale, "short");
}
