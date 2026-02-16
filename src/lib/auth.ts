import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const SESSION_COOKIE_NAME = "session";
const CSRF_COOKIE_NAME = "csrf_token";
const MAGIC_LINK_EXPIRY = "15m"; // 15 minutes
const SESSION_EXPIRY = "7d"; // 7 days
const SESSION_ROTATION_THRESHOLD = 60 * 60 * 24 * 3; // Rotate token if less than 3 days remain

/**
 * Read JWT_SECRET fresh from process.env on every call (not cached at module load).
 * This ensures hot-reloads and env changes take effect without restart.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || "";
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters for security");
  }
  return secret;
}

/**
 * Read APP_URL fresh from process.env on every call.
 */
function getAppUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

/**
 * Payload for magic link JWT token
 */
interface MagicLinkPayload {
  email: string;
  type: "magic-link";
}

/**
 * Payload for session JWT token
 */
interface SessionPayload {
  userId: string;
  email: string;
  type: "session";
  jti?: string; // JWT ID for token revocation
  iat?: number; // Issued at
  exp?: number; // Expiration
  nbf?: number; // Not before
}

/**
 * Generate a magic link token for email authentication
 * @param email - User's email address
 * @returns JWT token string
 */
export function generateMagicLinkToken(email: string): string {
  const payload: MagicLinkPayload = {
    email: email.toLowerCase().trim(),
    type: "magic-link",
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: MAGIC_LINK_EXPIRY,
    issuer: getAppUrl(),
  });
}

/**
 * Verify a magic link token
 * @param token - JWT token from magic link
 * @returns Email address if valid, null if invalid/expired
 */
export function verifyMagicLinkToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      issuer: getAppUrl(),
    }) as MagicLinkPayload;

    if (payload.type !== "magic-link") {
      return null;
    }

    return payload.email;
  } catch (error) {
    return null;
  }
}

/**
 * Generate magic link URL
 * @param email - User's email address
 * @returns Full magic link URL
 */
export function generateMagicLink(email: string): string {
  const token = generateMagicLinkToken(email);
  return `${getAppUrl()}/auth/verify?token=${encodeURIComponent(token)}`;
}

/**
 * Create or update user and return user ID
 * @param email - User's email address
 * @returns User ID
 */
export async function findOrCreateUser(email: string): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();

  // Try to find existing user
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existingUser.length > 0) {
    return existingUser[0].id;
  }

  // Create new user
  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    email: normalizedEmail,
    role: "member",
  });

  return userId;
}

/**
 * Create session token with security enhancements
 * @param userId - User's ID
 * @param email - User's email
 * @returns JWT session token
 */
export function createSessionToken(userId: string, email: string): string {
  const payload: SessionPayload = {
    userId,
    email: email.toLowerCase().trim(),
    type: "session",
    jti: randomUUID(), // Unique token ID for revocation capability
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: SESSION_EXPIRY,
    issuer: getAppUrl(),
    audience: getAppUrl(),
    notBefore: "0s", // Token valid immediately (same as iat)
  });
}

/**
 * Verify session token with enhanced validation
 * @param token - JWT session token
 * @returns Session payload if valid, null otherwise
 */
export function verifySessionToken(
  token: string
): SessionPayload | null {
  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      issuer: getAppUrl(),
      audience: getAppUrl(),
      clockTolerance: 30, // Allow 30 seconds clock skew
    }) as SessionPayload;

    if (payload.type !== "session") {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Set session cookie with enhanced security flags
 * @param userId - User's ID
 * @param email - User's email
 */
export async function setSessionCookie(
  userId: string,
  email: string
): Promise<void> {
  const token = createSessionToken(userId, email);
  const csrfToken = randomUUID();
  const cookieStore = await cookies();

  // Set session cookie — sameSite "lax" prevents CSRF on POST requests
  // while allowing the cookie to be sent on cross-site GET navigations
  // (required for magic link flow: clicking link in email → our app).
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
    path: "/",
  });

  // CSRF token cookie (readable by JavaScript for form submission)
  cookieStore.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Must be readable by client-side JavaScript
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // Same expiry as session
    path: "/",
  });
}

/**
 * Get current session from cookie with automatic rotation
 * @returns Session payload or null if not authenticated
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie) {
    return null;
  }

  const payload = verifySessionToken(sessionCookie.value);

  if (!payload) {
    return null;
  }

  // Automatic token rotation: if token expires in less than 3 days, rotate it
  if (payload.exp) {
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = payload.exp - now;

    if (timeRemaining < SESSION_ROTATION_THRESHOLD && timeRemaining > 0) {
      // Rotate token silently in the background
      await setSessionCookie(payload.userId, payload.email);
    }
  }

  return payload;
}

/**
 * Get current user from session
 * @returns User object or null if not authenticated
 */
export async function getCurrentUser() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  return user.length > 0 ? user[0] : null;
}

/**
 * Clear session and CSRF cookies (logout)
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(CSRF_COOKIE_NAME);
}

/**
 * Require authentication - throws if not authenticated
 * @returns Current user
 */
export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

// CSRF utilities re-exported from dedicated module
export { getCsrfToken, validateCsrfToken, requireCsrfToken } from "./csrf";
