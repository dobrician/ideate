import { NextRequest, NextResponse } from "next/server";
import { resetPasswordWithToken, validatePassword } from "@/lib/password";
import { requireOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { logger } from "@/lib/logger";
import { z } from "zod";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_PER_IP = 10; // 10 reset attempts per IP per 15 minutes

const resetSchema = z.object({
  token: z.string({ error: "Reset token is required" }).min(1, "Reset token is required"),
  password: z.string({ error: "Password is required" }).min(1, "Password is required"),
  confirmPassword: z.string({ error: "Please confirm your password" }).min(1, "Please confirm your password"),
});

/**
 * POST /auth/reset-password
 * Reset password using a valid reset token.
 * Rate limited: 10 attempts per IP per 15 minutes.
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF defense: validate Origin header
    const originError = requireOrigin(request);
    if (originError) return originError;

    // Rate limit by IP to prevent token brute-force
    const clientIp = getClientIp(request);
    const ipCheck = checkRateLimit(
      `reset:ip:${clientIp}`,
      MAX_PER_IP,
      WINDOW_MS
    );
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(ipCheck.retryAfterMs / 1000)),
          },
        }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    const result = resetSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { token, password, confirmPassword } = result.data;

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

    const email = await resetPasswordWithToken(token, password);

    if (!email) {
      return NextResponse.json(
        { error: "Invalid or expired reset link. Please request a new one." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You can now sign in.",
    });
  } catch (error) {
    logger.error({ err: error }, "Reset password error");
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
