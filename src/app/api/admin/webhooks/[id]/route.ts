import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Role } from "@/lib/rbac";
import { requireOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { logger } from "@/lib/logger";
import { getDeliveryLogs, retryDelivery, testWebhook } from "@/lib/webhooks";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/webhooks/[id] — Get webhook details + delivery logs (admin only)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const action = request.nextUrl.searchParams.get("action");

    // Test webhook
    if (action === "test") {
      try {
        const deliveryId = await testWebhook(id);
        return NextResponse.json({ success: true, deliveryId });
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Test failed" }, { status: 400 });
      }
    }

    // Retry a failed delivery
    const retryId = request.nextUrl.searchParams.get("retry");
    if (retryId) {
      const ok = await retryDelivery(retryId);
      return NextResponse.json({ success: ok });
    }

    const [wh] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
    if (!wh) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const logs = await getDeliveryLogs(id);

    return NextResponse.json({
      webhook: {
        ...wh,
        events: JSON.parse(wh.events),
        secret: wh.secret.slice(0, 8) + "...",
        retryConfig: wh.retryConfig ? JSON.parse(wh.retryConfig) : null,
        payloadTemplate: wh.payloadTemplate ? JSON.parse(wh.payloadTemplate) : null,
      },
      deliveryLogs: logs,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to get webhook details");
    return NextResponse.json({ error: "Failed to get webhook details" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/webhooks/[id] — Update a webhook (admin only)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const originError = requireOrigin(request);
    if (originError) return originError;

    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`admin-wh:${getClientIp(request)}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
    }

    const { id } = await context.params;
    const body = await request.json();

    const existing = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (body.url !== undefined) {
      try {
        new URL(body.url);
        updates.url = body.url;
      } catch {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
      }
    }

    if (body.events !== undefined) {
      if (!Array.isArray(body.events) || body.events.length === 0) {
        return NextResponse.json({ error: "At least one event is required" }, { status: 400 });
      }
      updates.events = JSON.stringify(body.events);
    }

    if (body.active !== undefined) {
      updates.active = Boolean(body.active);
    }

    if (body.description !== undefined) {
      updates.description = body.description || null;
    }

    if (body.retryConfig !== undefined) {
      updates.retryConfig = body.retryConfig ? JSON.stringify(body.retryConfig) : null;
    }

    if (body.payloadTemplate !== undefined) {
      updates.payloadTemplate = body.payloadTemplate ? JSON.stringify(body.payloadTemplate) : null;
    }

    await db.update(webhooks).set(updates).where(eq(webhooks.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to update webhook");
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/webhooks/[id] — Delete a webhook (admin only)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`admin-wh:${getClientIp(request)}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
    }

    const { id } = await context.params;

    const existing = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    await db.delete(webhooks).where(eq(webhooks.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete webhook");
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
  }
}
