/**
 * Comma-separated list of trusted proxy IPs, or "*" to trust all.
 * When not set, forwarded headers are ignored to prevent IP spoofing.
 */
const TRUSTED_PROXIES = process.env.TRUSTED_PROXIES ?? "";

function isTrustedProxy(): boolean {
  return TRUSTED_PROXIES === "*" || TRUSTED_PROXIES.length > 0;
}

/**
 * Extract client IP from request headers.
 * Only trusts x-forwarded-for / x-real-ip when TRUSTED_PROXIES is configured.
 * Falls back to "unknown" when no trusted proxy is set or no header is present.
 */
export function getClientIp(request: Request): string {
  if (isTrustedProxy()) {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;

    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp;
  }

  return "unknown";
}
