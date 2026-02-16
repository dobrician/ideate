import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const BCRYPT_ROUNDS = 12;
const VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Password complexity requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 */
export function validatePassword(password: string): {
  valid: boolean;
  error?: string;
} {
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain an uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain a lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain a number" };
  }
  return { valid: true };
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a secure random token for email verification or password reset
 */
export function generateSecureToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Register a new user with email and password
 * @returns Object with userId and verificationToken
 * @throws Error if email already registered with a password
 */
export async function registerUser(
  email: string,
  password: string
): Promise<{ userId: string; verificationToken: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0 && existing[0].passwordHash) {
    throw new Error("Email already registered");
  }

  const passwordHash = await hashPassword(password);
  const verificationToken = generateSecureToken();
  const verificationExpires = new Date(
    Date.now() + VERIFICATION_TOKEN_EXPIRY_MS
  );

  if (existing.length > 0) {
    // User exists from magic link flow - add password
    await db
      .update(users)
      .set({
        passwordHash,
        verificationToken,
        verificationTokenExpires: verificationExpires,
      })
      .where(eq(users.id, existing[0].id));
    return { userId: existing[0].id, verificationToken };
  }

  // Create new user
  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    email: normalizedEmail,
    passwordHash,
    emailVerified: false,
    verificationToken,
    verificationTokenExpires: verificationExpires,
    role: "member",
  });

  return { userId, verificationToken };
}

/**
 * Authenticate user with email and password
 * @returns userId if credentials are valid, null otherwise
 */
export async function authenticateWithPassword(
  email: string,
  password: string
): Promise<{ userId: string; emailVerified: boolean } | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (user.length === 0 || !user[0].passwordHash) {
    return null;
  }

  const isValid = await verifyPassword(password, user[0].passwordHash);
  if (!isValid) {
    return null;
  }

  return {
    userId: user[0].id,
    emailVerified: user[0].emailVerified ?? false,
  };
}

/**
 * Verify email using the verification token
 * @returns email if token is valid, null otherwise
 */
export async function verifyEmailToken(
  token: string
): Promise<string | null> {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.verificationToken, token))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  const expires = user[0].verificationTokenExpires;
  if (expires && expires.getTime() < Date.now()) {
    return null;
  }

  await db
    .update(users)
    .set({
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpires: null,
    })
    .where(eq(users.id, user[0].id));

  return user[0].email;
}

/**
 * Generate a password reset token for a user
 * @returns Reset token if user exists, null otherwise
 */
export async function generatePasswordResetToken(
  email: string
): Promise<string | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  const resetToken = generateSecureToken();
  const resetExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  await db
    .update(users)
    .set({
      resetToken,
      resetTokenExpires: resetExpires,
    })
    .where(eq(users.id, user[0].id));

  return resetToken;
}

/**
 * Reset password using a reset token
 * @returns email if token is valid and password reset, null otherwise
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<string | null> {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.resetToken, token))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  const expires = user[0].resetTokenExpires;
  if (expires && expires.getTime() < Date.now()) {
    return null;
  }

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({
      passwordHash,
      emailVerified: true,
      resetToken: null,
      resetTokenExpires: null,
    })
    .where(eq(users.id, user[0].id));

  return user[0].email;
}

/**
 * Generate a new verification token for a user (for resending)
 * @returns New verification token or null if user not found
 */
export async function regenerateVerificationToken(
  email: string
): Promise<string | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  const verificationToken = generateSecureToken();
  const verificationExpires = new Date(
    Date.now() + VERIFICATION_TOKEN_EXPIRY_MS
  );

  await db
    .update(users)
    .set({
      verificationToken,
      verificationTokenExpires: verificationExpires,
    })
    .where(eq(users.id, user[0].id));

  return verificationToken;
}
