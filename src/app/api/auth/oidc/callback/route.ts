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
import { getSafeRedirect } from "@/lib/auth-redirect";

const STATE_COOKIE = "oidc_state";

/**
 * GET /api/auth/oidc/callback
 * Handle the OIDC callback — exchange code, fetch user info, create session.
 */
export async function GET(request: NextRequest) {
  let callbackBase = request.url;
  let destination = "/";
  const loginError = (msg: string) =>
    NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(msg)}&redirect=${encodeURIComponent(destination)}`, callbackBase)
    );

  try {
    const config = getOidcConfig();
    if (!config) return loginError("oidc_not_configured");
    callbackBase = config.redirectUri;

    const cookieStore = await cookies();
    const storedState = cookieStore.get(STATE_COOKIE)?.value;
    const codeVerifier = cookieStore.get("oidc_verifier")?.value;
    destination = getSafeRedirect(cookieStore.get("oidc_redirect")?.value ?? null);
    cookieStore.delete(STATE_COOKIE);
    cookieStore.delete("oidc_verifier");
    cookieStore.delete("oidc_redirect");

    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (searchParams.has("error")) return loginError("oidc_denied");
    if (!code || !state) return loginError("oidc_missing_params");

    if (!storedState || storedState !== state) {
      return loginError("oidc_state_mismatch");
    }

    if (!codeVerifier) return loginError("oidc_state_mismatch");
    const discovery = await fetchDiscovery(config.issuer);
    const tokens = await exchangeCode(discovery, config, code, codeVerifier);
    const userInfo = await fetchUserInfo(discovery, tokens.access_token);

    if (!userInfo.sub) return loginError("oidc_no_subject");
    if (!userInfo.email || userInfo.email_verified !== true) return loginError("oidc_unverified_email");

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

    return NextResponse.redirect(new URL(destination, callbackBase));
  } catch (err) {
    logger.error({ err }, "OIDC callback failed");
    return loginError("oidc_error");
  }
}
