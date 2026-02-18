import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Role } from "@/lib/rbac";
import { requireOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { randomBytes } from "crypto";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const VALID_EVENTS = [
  "project.created",
  "proposal.created",
  "vote.cast",
  "project.archived",
];

/**
 * GET /api/admin/webhooks — List all webhooks (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`admin-wh:${getClientIp(request)}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
    }

    const all = await db.select().from(webhooks);
    // Parse events JSON for each webhook, mask secret
    const result = all.map((wh) => ({
      ...wh,
      events: JSON.parse(wh.events) as string[],
      secret: wh.secret.slice(0, 8) + "...",
    }));

    return NextResponse.json({ webhooks: result });
  } catch (error) {
    logger.error({ err: error }, "Failed to list webhooks");
    return NextResponse.json({ error: "Failed to list webhooks" }, { status: 500 });
  }
}

/**
 * POST /api/admin/webhooks — Create a webhook (admin only)
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { url, events } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: "At least one event is required" }, { status: 400 });
    }

    const invalidEvents = events.filter((e: string) => !VALID_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `Invalid events: ${invalidEvents.join(", ")}` },
        { status: 400 }
      );
    }

    const secret = randomBytes(32).toString("hex");

    const [webhook] = await db
      .insert(webhooks)
      .values({
        url,
        events: JSON.stringify(events),
        secret,
      })
      .returning();

    return NextResponse.json({
      webhook: { ...webhook, events, secret },
    }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "Failed to create webhook");
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
  }
}
