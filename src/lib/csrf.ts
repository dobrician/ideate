import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

const CSRF_COOKIE_NAME = "csrf_token";

/**
 * CSRF Defense Strategy
 * ---------------------
 * Primary defense: sameSite="lax" on session cookies.
 *   - Browsers do NOT send lax cookies on cross-site POST requests.
 *   - This blocks classical CSRF attacks where a malicious site submits a
 *     form to our API endpoints.
 *   - "lax" (vs "strict") allows the cookie on cross-site GET navigations,
 *     which is required for the magic link flow (email → our app).
 *
 * Secondary defense: Origin header validation on all mutation routes.
 *   - Rejects requests where the Origin header doesn't match our APP_URL.
 *   - Catches edge cases where sameSite might not be enforced (older browsers).
 *
 * The double-submit CSRF cookie pattern (csrf_token cookie + header) is
 * available as a third layer but not enforced on auth routes since the
 * above two layers provide sufficient protection.
 */

/**
 * Validate that the Origin header matches our app URL.
 * Returns true if the request is same-origin, false otherwise.
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const expectedOrigin = new URL(appUrl).origin;

  // No Origin header: allow (same-origin requests may omit it)
  if (!origin) return true;

  return origin === expectedOrigin;
}

/**
 * Require valid Origin header on mutation requests.
 * Returns a 403 JSON response if Origin doesn't match, or null if valid.
 */
export function requireOrigin(request: NextRequest): Response | null {
  if (!validateOrigin(request)) {
    return Response.json(
      { error: "Forbidden: cross-origin request" },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Get CSRF token from cookie
 */
export async function getCsrfToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const csrfCookie = cookieStore.get(CSRF_COOKIE_NAME);
  return csrfCookie?.value || null;
}

/**
 * Validate CSRF token from request against cookie (double-submit pattern)
 */
export async function validateCsrfToken(submittedToken: string): Promise<boolean> {
  const cookieCsrfToken = await getCsrfToken();

  if (!cookieCsrfToken || !submittedToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  const a = Buffer.from(cookieCsrfToken, "utf-8");
  const b = Buffer.from(submittedToken, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Require valid CSRF token - throws if invalid
 */
export async function requireCsrfToken(submittedToken: string): Promise<void> {
  const isValid = await validateCsrfToken(submittedToken);

  if (!isValid) {
    throw new Error("Invalid CSRF token");
  }
}
