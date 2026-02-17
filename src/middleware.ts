import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight JWT validation for Edge middleware.
 * Decodes the payload and checks expiry/structure without full crypto verification
 * (Edge runtime can't use node:crypto). Full jwt.verify() happens downstream in
 * getSession()/requireAuth().
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
  "/api/test/seed",
  "/sitemap.xml",
  "/robots.txt",
  "/manifest.json",
  "/sw.js",
  "/offline.html",
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
  return false;
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
 * Auth middleware with security headers and locale forwarding.
 * Forwards locale cookie as a header so Next.js invalidates
 * its client router cache when locale changes.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = request.cookies.get("locale")?.value || "en";

  if (isPublicPath(pathname)) {
    const response = NextResponse.next({
      request: { headers: new Headers(request.headers) },
    });
    response.headers.set("x-locale", locale);
    return addSecurityHeaders(response);
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
    return addSecurityHeaders(response);
  }

  const response = NextResponse.next({
    request: { headers: new Headers(request.headers) },
  });
  response.headers.set("x-locale", locale);
  return addSecurityHeaders(response);
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
