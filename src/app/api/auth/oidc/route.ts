import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getOidcConfig,
  fetchDiscovery,
  generateState,
  generateCodeVerifier,
  buildAuthorizationUrl,
} from "@/lib/oidc";
import { logger } from "@/lib/logger";
import { getSafeRedirect } from "@/lib/auth-redirect";

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
    const codeVerifier = generateCodeVerifier();

    const cookieStore = await cookies();
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 600, // 10 minutes
      path: "/",
    };
    cookieStore.set(STATE_COOKIE, state, options);
    cookieStore.set("oidc_verifier", codeVerifier, options);
    cookieStore.set("oidc_redirect", getSafeRedirect(request.nextUrl.searchParams.get("redirect")), options);

    const authUrl = buildAuthorizationUrl(discovery, config, state, codeVerifier);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    logger.error({ err }, "OIDC initiation failed");
    return NextResponse.redirect(
      new URL(`/auth/login?error=oidc_error&redirect=${encodeURIComponent(getSafeRedirect(request.nextUrl.searchParams.get("redirect")))}`, request.url)
    );
  }
}
