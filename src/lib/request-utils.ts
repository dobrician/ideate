/**
 * Extract client IP from request headers.
 * Checks x-forwarded-for (first entry) and x-real-ip, falls back to "unknown".
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
