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
import { ALL_WEBHOOK_EVENTS, type RetryStrategy, getDeliveryStats } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

const VALID_RETRY_STRATEGIES: RetryStrategy[] = ["exponential", "linear", "fixed"];

/**
 * GET /api/admin/webhooks — List all webhooks with delivery stats (admin only)
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
    const result = all.map((wh) => ({
      ...wh,
      events: JSON.parse(wh.events) as string[],
      secret: wh.secret.slice(0, 8) + "...",
      retryConfig: wh.retryConfig ? JSON.parse(wh.retryConfig) : null,
      payloadTemplate: wh.payloadTemplate ? JSON.parse(wh.payloadTemplate) : null,
    }));

    const stats = await getDeliveryStats();

    return NextResponse.json({ webhooks: result, deliveryStats: stats, availableEvents: ALL_WEBHOOK_EVENTS });
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
    const { url, events, description, retryConfig, payloadTemplate } = body;

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

    // Allow wildcard patterns like "project.*" or "*"
    const invalidEvents = events.filter((e: string) => {
      if (e === "*") return false;
      if (e.endsWith(".*")) {
        const prefix = e.slice(0, -2);
        return !ALL_WEBHOOK_EVENTS.some((ev) => ev.startsWith(prefix + "."));
      }
      return !ALL_WEBHOOK_EVENTS.includes(e as typeof ALL_WEBHOOK_EVENTS[number]);
    });

    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `Invalid events: ${invalidEvents.join(", ")}` },
        { status: 400 },
      );
    }

    // Validate retry config if provided
    let retryConfigJson: string | undefined;
    if (retryConfig) {
      if (!VALID_RETRY_STRATEGIES.includes(retryConfig.strategy)) {
        return NextResponse.json({ error: "Invalid retry strategy" }, { status: 400 });
      }
      const maxAttempts = Math.min(Math.max(retryConfig.maxAttempts ?? 3, 1), 10);
      const baseDelayMs = Math.min(Math.max(retryConfig.baseDelayMs ?? 1000, 100), 60000);
      retryConfigJson = JSON.stringify({ strategy: retryConfig.strategy, maxAttempts, baseDelayMs });
    }

    // Validate payload template if provided
    let payloadTemplateJson: string | undefined;
    if (payloadTemplate) {
      const validFormats = ["default", "slack", "teams", "discord", "custom"];
      if (!validFormats.includes(payloadTemplate.format)) {
        return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
      }
      payloadTemplateJson = JSON.stringify(payloadTemplate);
    }

    const secret = randomBytes(32).toString("hex");

    const [webhook] = await db
      .insert(webhooks)
      .values({
        url,
        events: JSON.stringify(events),
        secret,
        description: description || null,
        retryConfig: retryConfigJson,
        payloadTemplate: payloadTemplateJson,
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
