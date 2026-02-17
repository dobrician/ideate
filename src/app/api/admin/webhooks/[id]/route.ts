import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Role } from "@/lib/rbac";
import { requireOrigin } from "@/lib/csrf";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

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
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
