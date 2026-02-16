import { NextRequest, NextResponse } from "next/server";

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
    pathname.includes(".")
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

  if (!sessionCookie?.value) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
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
