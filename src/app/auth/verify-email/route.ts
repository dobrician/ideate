import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/password";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

function appUrl(path: string): string {
  return `${APP_URL}${path}`;
}

/**
 * GET /auth/verify-email?token=...
 * Verifies email using the verification token from registration.
 * Redirects to login on success, or to verify-email page on failure.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      appUrl("/auth/login?error=missing_token")
    );
  }

  try {
    const email = await verifyEmailToken(token);

    if (!email) {
      return NextResponse.redirect(
        appUrl("/auth/login?error=invalid_or_expired_token")
      );
    }

    return NextResponse.redirect(
      appUrl("/auth/login?verified=true")
    );
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.redirect(
      appUrl("/auth/login?error=verification_failed")
    );
  }
}
