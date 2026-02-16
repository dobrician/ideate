"use client";

/**
 * Read the CSRF token from the csrf_token cookie (client-side).
 * Returns empty string if cookie not found.
 */
export function getCsrfTokenClient(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(
    /(?:^|;\s*)csrf_token=([^;]*)/
  );
  return match ? decodeURIComponent(match[1]) : "";
}
