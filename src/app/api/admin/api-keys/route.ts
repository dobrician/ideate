import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Role } from "@/lib/rbac";
import { requireOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { logger } from "@/lib/logger";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  getApiKeyStats,
  validateScopes,
  API_SCOPES,
  TIER_CONFIGS,
  type ApiScope,
  type ApiKeyTier,
} from "@/lib/api-keys";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/api-keys — List API keys + stats (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`admin-keys:${getClientIp(request)}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
    }

    const keys = await listApiKeys(user.id);
    const stats = await getApiKeyStats();

    return NextResponse.json({
      keys,
      stats,
      availableScopes: API_SCOPES,
      tierConfigs: TIER_CONFIGS,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to list API keys");
    return NextResponse.json({ error: "Failed to list API keys" }, { status: 500 });
  }
}

/**
 * POST /api/admin/api-keys — Create an API key (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const originError = requireOrigin(request);
    if (originError) return originError;

    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`admin-keys:${getClientIp(request)}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
    }

    const body = await request.json();
    const { name, scopes, tier, expiresInDays } = body;

    if (!name || typeof name !== "string" || name.length > 100) {
      return NextResponse.json({ error: "Name is required (max 100 chars)" }, { status: 400 });
    }

    if (!Array.isArray(scopes) || scopes.length === 0) {
      return NextResponse.json({ error: "At least one scope is required" }, { status: 400 });
    }

    if (!validateScopes(scopes)) {
      return NextResponse.json({ error: `Invalid scopes. Valid: ${API_SCOPES.join(", ")}` }, { status: 400 });
    }

    const validTiers: ApiKeyTier[] = ["basic", "pro", "enterprise"];
    if (tier && !validTiers.includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    let expiresAt: Date | undefined;
    if (expiresInDays && typeof expiresInDays === "number" && expiresInDays > 0) {
      expiresAt = new Date(Date.now() + expiresInDays * 86400000);
    }

    const result = await createApiKey({
      name,
      userId: user.id,
      scopes: scopes as ApiScope[],
      tier: tier as ApiKeyTier,
      expiresAt,
    });

    return NextResponse.json({
      id: result.id,
      rawKey: result.rawKey,
      prefix: result.prefix,
      message: "Save this key — it will not be shown again",
    }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "Failed to create API key");
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/api-keys — Revoke an API key (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const originError = requireOrigin(request);
    if (originError) return originError;

    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const keyId = request.nextUrl.searchParams.get("id");
    if (!keyId) {
      return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
    }

    await revokeApiKey(keyId);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to revoke API key");
    return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 });
  }
}
