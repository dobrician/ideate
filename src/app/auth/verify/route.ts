import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLinkToken, findOrCreateUser, setSessionCookie } from "@/lib/auth";
import { logger } from "@/lib/logger";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

function appUrl(path: string): string {
  return `${APP_URL}${path}`;
}

/**
 * GET /auth/verify?token=...&redirect=...
 * Verifies the magic link token, creates/finds user, sets session cookie, and redirects.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const redirectTo = request.nextUrl.searchParams.get("redirect");

  if (!token) {
    return NextResponse.redirect(appUrl("/auth/login?error=missing_token"));
  }

  try {
    const email = verifyMagicLinkToken(token);

    if (!email) {
      return NextResponse.redirect(appUrl("/auth/login?error=invalid_token"));
    }

    const userId = await findOrCreateUser(email);
    await setSessionCookie(userId, email);

    const destination = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/";
    return NextResponse.redirect(appUrl(destination));
  } catch (error) {
    logger.error({ err: error }, "Verification error");
    return NextResponse.redirect(appUrl("/auth/login?error=verification_failed"));
  }
}
