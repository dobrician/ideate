import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/password";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request-utils";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/verify-email
 * Verifies email using the verification token from registration.
 * Returns JSON with success/error instead of redirecting.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = body.token;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Missing verification token" },
        { status: 400 }
      );
    }

    const email = await verifyEmailToken(token);

    if (!email) {
      return NextResponse.json(
        { error: "Invalid or expired verification link" },
        { status: 400 }
      );
    }

    logAudit({
      userId: null,
      action: "verify_email",
      entity: "user",
      details: `email=${email}`,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Email verification error");
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
