import { NextRequest, NextResponse } from "next/server";
import { regenerateVerificationToken } from "@/lib/password";
import { sendVerificationEmail } from "@/lib/mail";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { logger } from "@/lib/logger";
import { z } from "zod";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_PER_IP = 5;
const MAX_PER_EMAIL = 2;

const resendSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

/**
 * POST /api/auth/resend-verification
 * Resend verification email. Rate limited: 2 per email / 5 per IP per 15 min.
 */
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);

    const ipCheck = checkRateLimit(
      `resend:ip:${clientIp}`,
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
    const result = resendSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = result.data;

    const emailCheck = checkRateLimit(
      `resend:email:${email.toLowerCase().trim()}`,
      MAX_PER_EMAIL,
      WINDOW_MS
    );
    if (!emailCheck.allowed) {
      // Return success to prevent enumeration
      return NextResponse.json({
        success: true,
        message: "If the account exists, a verification email has been sent.",
      });
    }

    const token = await regenerateVerificationToken(email);

    if (token) {
      const verifyLink = `${APP_URL}/auth/verify-email?token=${encodeURIComponent(token)}`;
      try {
        await sendVerificationEmail(email, verifyLink);
      } catch (error) {
        logger.error({ err: error }, "Failed to send verification email");
        if (process.env.NODE_ENV === "development") {
          return NextResponse.json(
            { error: "Failed to send email. Check SMTP config." },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "If the account exists, a verification email has been sent.",
    });
  } catch (error) {
    logger.error({ err: error }, "Resend verification error");
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
