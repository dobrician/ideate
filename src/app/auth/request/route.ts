import { NextRequest, NextResponse } from "next/server";
import { generateMagicLink } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/mail";
import { requireOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { logger } from "@/lib/logger";
import { z } from "zod";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 20;

/**
 * Email validation schema
 */
const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address").toLowerCase().trim(),
});

/**
 * POST /auth/request
 * Request a magic link to be sent to the provided email.
 * Rate limited: 5 per email / 20 per IP per 15 minutes.
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF defense: validate Origin header
    const originError = requireOrigin(request);
    if (originError) return originError;

    const clientIp = getClientIp(request);

    // IP-level rate limit
    const ipCheck = checkRateLimit(`auth:ip:${clientIp}`, MAX_PER_IP, WINDOW_MS);
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

    // Validate email
    const result = emailSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = result.data;

    // Per-email rate limit
    const emailCheck = checkRateLimit(
      `auth:email:${email}`,
      MAX_PER_EMAIL,
      WINDOW_MS
    );
    if (!emailCheck.allowed) {
      // Still return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message:
          "If an account exists with this email, a magic link has been sent.",
      });
    }

    // Generate magic link
    const magicLink = generateMagicLink(email);

    // Send email
    try {
      await sendMagicLinkEmail(email, magicLink);
    } catch (error) {
      logger.error({ err: error }, "Failed to send magic link");
      if (process.env.NODE_ENV === "development") {
        return NextResponse.json(
          { error: "Failed to send email. Check SMTP configuration." },
          { status: 500 }
        );
      }
    }

    // Always return success to prevent email enumeration attacks
    return NextResponse.json({
      success: true,
      message:
        "If an account exists with this email, a magic link has been sent.",
    });
  } catch (error) {
    logger.error({ err: error }, "Magic link request error");
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
