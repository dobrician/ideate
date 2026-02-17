import { NextRequest, NextResponse } from "next/server";
import { registerUser, validatePassword } from "@/lib/password";
import { sendVerificationEmail } from "@/lib/mail";
import { requireOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { captureError } from "@/lib/sentry";
import { z } from "zod";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_PER_IP = 10;

const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
});

/**
 * POST /auth/register
 * Register a new user with email and password.
 * Rate limited: 10 per IP per 15 minutes.
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF defense: validate Origin header
    const originError = requireOrigin(request);
    if (originError) return originError;

    const clientIp = getClientIp(request);

    // IP-level rate limit
    const ipCheck = checkRateLimit(
      `register:ip:${clientIp}`,
      MAX_PER_IP,
      WINDOW_MS
    );
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(ipCheck.retryAfterMs / 1000)),
          },
        }
      );
    }

    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password, confirmPassword } = result.data;

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 }
      );
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.error },
        { status: 400 }
      );
    }

    const { userId, verificationToken } = await registerUser(email, password);
    logAudit({ userId, action: "register", entity: "user", details: `email=${email}`, ipAddress: clientIp });

    const verifyLink = `${APP_URL}/auth/verify-email?token=${encodeURIComponent(verificationToken)}`;

    try {
      await sendVerificationEmail(email, verifyLink);
    } catch (error) {
      logger.error({ err: error }, "Failed to send verification email");
      if (process.env.NODE_ENV === "development") {
        return NextResponse.json(
          { error: "Failed to send verification email. Check SMTP config." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Account created. Please check your email to verify.",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Email already registered"
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }
    logger.error({ err: error }, "Registration error");
    captureError(error, { route: "POST /api/auth/register" });
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
