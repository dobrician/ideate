import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getOidcConfig,
  fetchDiscovery,
  generateState,
  buildAuthorizationUrl,
} from "@/lib/oidc";
import { logger } from "@/lib/logger";

const STATE_COOKIE = "oidc_state";

/**
 * GET /api/auth/oidc
 * Initiate OIDC login — redirect to the provider's authorization endpoint.
 */
export async function GET(request: NextRequest) {
  try {
    const config = getOidcConfig();
    if (!config) {
      return NextResponse.json(
        { error: "OIDC is not configured" },
        { status: 404 }
      );
    }

    const discovery = await fetchDiscovery(config.issuer);
    const state = generateState();

    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    const authUrl = buildAuthorizationUrl(discovery, config, state);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    logger.error({ err }, "OIDC initiation failed");
    return NextResponse.redirect(
      new URL("/auth/login?error=oidc_error", request.url)
    );
  }
}
