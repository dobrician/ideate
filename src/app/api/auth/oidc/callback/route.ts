import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getOidcConfig,
  fetchDiscovery,
  exchangeCode,
  fetchUserInfo,
  findOrLinkOidcUser,
} from "@/lib/oidc";
import { setSessionCookie } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

const STATE_COOKIE = "oidc_state";

/**
 * GET /api/auth/oidc/callback
 * Handle the OIDC callback — exchange code, fetch user info, create session.
 */
export async function GET(request: NextRequest) {
  const loginError = (msg: string) =>
    NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(msg)}`, request.url)
    );

  try {
    const config = getOidcConfig();
    if (!config) return loginError("oidc_not_configured");

    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      logger.warn({ error: errorParam }, "OIDC provider returned error");
      return loginError("oidc_denied");
    }

    if (!code || !state) return loginError("oidc_missing_params");

    const cookieStore = await cookies();
    const storedState = cookieStore.get(STATE_COOKIE)?.value;
    cookieStore.delete(STATE_COOKIE);

    if (!storedState || storedState !== state) {
      return loginError("oidc_state_mismatch");
    }

    const discovery = await fetchDiscovery(config.issuer);
    const tokens = await exchangeCode(discovery, config, code);
    const userInfo = await fetchUserInfo(discovery, tokens.access_token);

    if (!userInfo.sub) return loginError("oidc_no_subject");

    const providerName = new URL(config.issuer).hostname;
    const { userId, isNew } = await findOrLinkOidcUser(
      providerName,
      userInfo.sub,
      userInfo.email,
      {
        firstName: userInfo.given_name || userInfo.name?.split(" ")[0],
        lastName: userInfo.family_name || userInfo.name?.split(" ").slice(1).join(" "),
        avatarUrl: userInfo.picture,
      }
    );

    const email = userInfo.email || `${providerName}-${userInfo.sub}@oidc.local`;
    await setSessionCookie(userId, email);

    logAudit({
      userId,
      action: isNew ? "oidc_register" : "oidc_login",
      entity: "session",
      details: `provider=${providerName}`,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    });

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (err) {
    logger.error({ err }, "OIDC callback failed");
    return loginError("oidc_error");
  }
}
