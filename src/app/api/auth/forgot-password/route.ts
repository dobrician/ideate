import { NextRequest, NextResponse } from "next/server";
import { generatePasswordResetToken } from "@/lib/password";
import { sendPasswordResetEmail } from "@/lib/mail";
import { requireOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { z } from "zod";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_PER_EMAIL = 3;
const MAX_PER_IP = 10;

const forgotSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

/**
 * POST /auth/forgot-password
 * Request a password reset link via email.
 * Rate limited: 3 per email / 10 per IP per 15 minutes.
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF defense: validate Origin header
    const originError = requireOrigin(request);
    if (originError) return originError;

    const clientIp = getClientIp(request);

    // IP-level rate limit
    const ipCheck = checkRateLimit(
      `forgot:ip:${clientIp}`,
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
    const result = forgotSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = result.data;

    // Per-email rate limit
    const emailCheck = checkRateLimit(
      `forgot:email:${email.toLowerCase().trim()}`,
      MAX_PER_EMAIL,
      WINDOW_MS
    );
    if (!emailCheck.allowed) {
      // Return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: "If an account exists, a reset link has been sent.",
      });
    }

    const resetToken = await generatePasswordResetToken(email);
    logAudit({ userId: null, action: "password_reset_request", entity: "user", details: `email=${email}`, ipAddress: clientIp });

    if (resetToken) {
      const resetLink = `${APP_URL}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;
      try {
        await sendPasswordResetEmail(email, resetLink);
      } catch (error) {
        logger.error({ err: error }, "Failed to send reset email");
        if (process.env.NODE_ENV === "development") {
          return NextResponse.json(
            { error: "Failed to send email. Check SMTP configuration." },
            { status: 500 }
          );
        }
      }
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account exists, a reset link has been sent.",
    });
  } catch (error) {
    logger.error({ err: error }, "Forgot password error");
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
