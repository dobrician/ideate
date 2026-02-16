import { NextRequest, NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth";
import { requireOrigin } from "@/lib/csrf";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/request-utils";
import { logger } from "@/lib/logger";

/**
 * POST /auth/logout
 * Clear session and redirect to login (clean page, no sidebar)
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF defense: validate Origin header
    const originError = requireOrigin(request);
    if (originError) return originError;

    const session = await getSession();
    const clientIp = getClientIp(request);
    await clearSession();
    logAudit({ userId: session?.userId ?? null, action: "logout", entity: "session", ipAddress: clientIp });

    const acceptHeader = request.headers.get("accept") || "";
    if (acceptHeader.includes("application/json")) {
      return NextResponse.json({
        success: true,
        message: "Logged out successfully",
      });
    }

    const baseUrl = process.env.APP_URL || request.url;
    const url = new URL("/auth/login", baseUrl);
    const response = NextResponse.redirect(url);
    // Ensure cookies are cleared in the redirect response as well
    response.cookies.delete("session");
    response.cookies.delete("csrf_token");
    return response;
  } catch (error) {
    logger.error({ err: error }, "Logout error");
    return NextResponse.json(
      { error: "An error occurred during logout" },
      { status: 500 }
    );
  }
}
