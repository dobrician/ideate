import { cookies } from "next/headers";

const CSRF_COOKIE_NAME = "csrf_token";

/**
 * Get CSRF token from cookie
 * @returns CSRF token string or null
 */
export async function getCsrfToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const csrfCookie = cookieStore.get(CSRF_COOKIE_NAME);
  return csrfCookie?.value || null;
}

/**
 * Validate CSRF token from request against cookie
 * @param submittedToken - CSRF token from form/request header
 * @returns True if valid, false otherwise
 */
export async function validateCsrfToken(submittedToken: string): Promise<boolean> {
  const cookieCsrfToken = await getCsrfToken();

  if (!cookieCsrfToken || !submittedToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return cookieCsrfToken === submittedToken;
}

/**
 * Require valid CSRF token - throws if invalid
 * @param submittedToken - CSRF token from form/request header
 */
export async function requireCsrfToken(submittedToken: string): Promise<void> {
  const isValid = await validateCsrfToken(submittedToken);

  if (!isValid) {
    throw new Error("Invalid CSRF token");
  }
}
