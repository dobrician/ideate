import { db } from "@/db";
import { users, oauthAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID, randomBytes } from "crypto";
import { logger } from "@/lib/logger";

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
}

interface OidcTokenResponse {
  access_token: string;
  id_token?: string;
  token_type: string;
}

export interface OidcUserInfo {
  sub: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

let discoveryCache: { config: OidcDiscovery; expires: number } | null = null;

export function getOidcConfig(): OidcConfig | null {
  const issuer = process.env.OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  const redirectUri =
    process.env.OIDC_REDIRECT_URI ||
    `${process.env.APP_URL || "http://localhost:3000"}/api/auth/oidc/callback`;

  if (!issuer || !clientId || !clientSecret) return null;
  return { issuer, clientId, clientSecret, redirectUri };
}

export async function fetchDiscovery(issuer: string): Promise<OidcDiscovery> {
  if (discoveryCache && Date.now() < discoveryCache.expires) {
    return discoveryCache.config;
  }

  const url = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);

  const data = await res.json();
  const config: OidcDiscovery = {
    authorization_endpoint: data.authorization_endpoint,
    token_endpoint: data.token_endpoint,
    userinfo_endpoint: data.userinfo_endpoint,
  };

  discoveryCache = { config, expires: Date.now() + 3600_000 };
  return config;
}

export function clearDiscoveryCache(): void {
  discoveryCache = null;
}

export function generateState(): string {
  return randomBytes(32).toString("hex");
}

export function buildAuthorizationUrl(
  discovery: OidcDiscovery,
  config: OidcConfig,
  state: string
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "openid email profile",
    state,
  });
  return `${discovery.authorization_endpoint}?${params.toString()}`;
}

export async function exchangeCode(
  discovery: OidcDiscovery,
  config: OidcConfig,
  code: string
): Promise<OidcTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const res = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function fetchUserInfo(
  discovery: OidcDiscovery,
  accessToken: string
): Promise<OidcUserInfo> {
  const res = await fetch(discovery.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`UserInfo failed: ${res.status}`);
  return res.json();
}

export async function findOrLinkOidcUser(
  provider: string,
  providerAccountId: string,
  email: string | undefined,
  profile: { firstName?: string; lastName?: string; avatarUrl?: string }
): Promise<{ userId: string; isNew: boolean }> {
  const existing = await db
    .select()
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerAccountId, providerAccountId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return { userId: existing[0].userId, isNew: false };
  }

  if (email) {
    const emailUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (emailUser.length > 0) {
      await db.insert(oauthAccounts).values({
        userId: emailUser[0].id,
        provider,
        providerAccountId,
      });
      logger.info({ provider, email }, "Linked OIDC account to existing user");
      return { userId: emailUser[0].id, isNew: false };
    }
  }

  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    email: email?.toLowerCase().trim() || `${provider}-${providerAccountId}@oidc.local`,
    firstName: profile.firstName || null,
    lastName: profile.lastName || null,
    avatarUrl: profile.avatarUrl || null,
    emailVerified: true,
    role: "member",
  });

  await db.insert(oauthAccounts).values({
    userId,
    provider,
    providerAccountId,
  });

  logger.info({ provider, email, userId }, "Created new OIDC user");
  return { userId, isNew: true };
}
