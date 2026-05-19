import { NextRequest, NextResponse } from "next/server";
import { recordTiming } from "@/lib/perf-monitor";

export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Lightweight JWT validation for proxy.
 * Decodes the payload and checks expiry/structure without full crypto verification.
 * Full jwt.verify() happens downstream in getSession()/requireAuth().
 */
function isValidSessionJwt(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    // Decode payload (base64url → JSON)
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );

    // Must be a session token
    if (payload.type !== "session") return false;

    // Must have userId
    if (!payload.userId) return false;

    // Check expiry (with 30s tolerance matching auth.ts clockTolerance)
    if (typeof payload.exp === "number") {
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp + 30 < now) return false;
    }

    return true;
  } catch {
    return false;
  }
}

const PUBLIC_PATHS = [
  "/",
  "/auth/login",
  "/auth/verify",
  "/auth/request",
  "/auth/logout",
  "/auth/register",
  "/auth/verify-email",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/api/auth/register",
  "/api/auth/login-password",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/resend-verification",
  "/api/auth/verify-email",
  "/api/health",
  "/api/votes/stream",
  "/api/search",
  "/api/email/deliverability",
  "/api/me",
  "/api/cron/project-summaries",
  "/api/cron/jobs",
  "/api/auth/oidc",
  "/api/auth/oidc/callback",
  "/api/test/seed",
  "/sitemap.xml",
  "/robots.txt",
  "/manifest.json",
  "/sw.js",
  "/offline.html",
];

/**
 * Route prefixes that require authentication.
 * Any path not matching these prefixes (and not an API route) will be allowed
 * through — if it doesn't match a real page, Next.js renders the 404 page.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/profile",
  "/projects",
];

/**
 * Check if a path matches public routes (exact or prefix match)
 */
function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) {
    return true;
  }
  // Allow static assets, Next.js internals, and icons
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons/") ||
    /\.(css|js|ico|png|jpg|jpeg|svg|woff|woff2|webp|avif|gif|map|txt|xml|json|webmanifest)$/i.test(pathname)
  ) {
    return true;
  }
  // Dynamic OG image endpoint must be reachable by social-media scrapers.
  if (pathname.startsWith("/api/og/")) {
    return true;
  }
  return false;
}

/**
 * Check if a path requires authentication.
 * Only known protected prefixes and non-public API routes require auth.
 * Unknown paths are let through so Next.js can render 404 for everyone.
 */
function isProtectedPath(pathname: string): boolean {
  // Non-public API routes require auth
  if (pathname.startsWith("/api/")) return true;
  // Known protected page routes
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

function withPerfHeaders(response: NextResponse, request: NextRequest, start: number): NextResponse {
  const durationMs = Date.now() - start;
  response.headers.set("x-response-time", `${durationMs}ms`);
  response.headers.set("server-timing", `total;dur=${durationMs}`);
  response.headers.set("x-request-deadline", String(start + REQUEST_TIMEOUT_MS));
  response.headers.set("x-request-timeout", String(REQUEST_TIMEOUT_MS));

  recordTiming({
    path: request.nextUrl.pathname,
    method: request.method,
    status: response.status,
    durationMs,
    timestamp: Date.now(),
  });

  return response;
}

/**
 * Add security headers to the response
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains"
  );
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  );
  return response;
}

/**
 * Auth proxy with security headers and locale forwarding.
 * Forwards locale cookie as a header so Next.js invalidates
 * its client router cache when locale changes.
 */
export function proxy(request: NextRequest) {
  const start = Date.now();
  const { pathname } = request.nextUrl;
  const locale = request.cookies.get("locale")?.value || "en";

  // Public paths and unknown routes (will 404) pass through without auth
  if (isPublicPath(pathname) || !isProtectedPath(pathname)) {
    const response = NextResponse.next({
      request: { headers: new Headers(request.headers) },
    });
    response.headers.set("x-locale", locale);
    return withPerfHeaders(addSecurityHeaders(response), request, start);
  }

  const sessionCookie = request.cookies.get("session");

  // Redirect to login if cookie is missing, empty, expired, or malformed
  if (!sessionCookie?.value || !isValidSessionJwt(sessionCookie.value)) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    // Clear invalid session cookie so user doesn't get stuck in a redirect loop
    if (sessionCookie?.value) {
      response.cookies.delete("session");
    }
    return withPerfHeaders(addSecurityHeaders(response), request, start);
  }

  const response = NextResponse.next({
    request: { headers: new Headers(request.headers) },
  });
  response.headers.set("x-locale", locale);
  return withPerfHeaders(addSecurityHeaders(response), request, start);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
