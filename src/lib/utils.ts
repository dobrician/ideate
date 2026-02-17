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
