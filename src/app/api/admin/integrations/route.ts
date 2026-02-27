import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Role } from "@/lib/rbac";
import { requireOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { logger } from "@/lib/logger";
import { testIntegration } from "@/lib/integrations";
import { ALL_WEBHOOK_EVENTS } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

const VALID_PLATFORMS = ["slack", "teams", "discord"] as const;

/**
 * GET /api/admin/integrations — List platform integrations (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`admin-int:${getClientIp(request)}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
    }

    const all = await db.select().from(integrations);
    const result = all.map((i) => ({
      ...i,
      events: JSON.parse(i.events) as string[],
      config: i.config ? JSON.parse(i.config) : null,
    }));

    return NextResponse.json({
      integrations: result,
      availablePlatforms: VALID_PLATFORMS,
      availableEvents: ALL_WEBHOOK_EVENTS,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to list integrations");
    return NextResponse.json({ error: "Failed to list integrations" }, { status: 500 });
  }
}

/**
 * POST /api/admin/integrations — Create a platform integration (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const originError = requireOrigin(request);
    if (originError) return originError;

    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`admin-int:${getClientIp(request)}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
    }

    const body = await request.json();
    const { platform, name, webhookUrl, events } = body;

    if (!VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: `Invalid platform. Valid: ${VALID_PLATFORMS.join(", ")}` }, { status: 400 });
    }

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!webhookUrl || typeof webhookUrl !== "string") {
      return NextResponse.json({ error: "Webhook URL is required" }, { status: 400 });
    }

    try {
      new URL(webhookUrl);
    } catch {
      return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 });
    }

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: "At least one event is required" }, { status: 400 });
    }

    const [integration] = await db
      .insert(integrations)
      .values({
        platform,
        name,
        webhookUrl,
        events: JSON.stringify(events),
        createdBy: user.id,
      })
      .returning();

    return NextResponse.json({ integration: { ...integration, events } }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "Failed to create integration");
    return NextResponse.json({ error: "Failed to create integration" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/integrations — Update or test an integration (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const originError = requireOrigin(request);
    if (originError) return originError;

    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Test integration
    if (body.action === "test" && body.id) {
      const result = await testIntegration(body.id);
      return NextResponse.json({ result });
    }

    // Toggle active status
    if (body.action === "toggle" && body.id) {
      const [existing] = await db.select().from(integrations).where(eq(integrations.id, body.id)).limit(1);
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      await db.update(integrations).set({ active: !existing.active, updatedAt: new Date() }).where(eq(integrations.id, body.id));
      return NextResponse.json({ success: true, active: !existing.active });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    logger.error({ err: error }, "Failed to update integration");
    return NextResponse.json({ error: "Failed to update integration" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/integrations — Delete an integration (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const originError = requireOrigin(request);
    if (originError) return originError;

    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    await db.delete(integrations).where(eq(integrations.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete integration");
    return NextResponse.json({ error: "Failed to delete integration" }, { status: 500 });
  }
}
