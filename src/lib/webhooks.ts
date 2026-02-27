import { db } from "@/db";
import { webhooks, webhookDeliveries } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";

// ─── Event Types ────────────────────────────────────────────────────────

export type WebhookEvent =
  | "project.created"
  | "project.updated"
  | "project.archived"
  | "project.deadline"
  | "proposal.created"
  | "proposal.updated"
  | "proposal.status_changed"
  | "vote.cast"
  | "comment.created"
  | "user.joined"
  | "workflow.stage_changed"
  | "integration.test";

export const ALL_WEBHOOK_EVENTS: WebhookEvent[] = [
  "project.created",
  "project.updated",
  "project.archived",
  "project.deadline",
  "proposal.created",
  "proposal.updated",
  "proposal.status_changed",
  "vote.cast",
  "comment.created",
  "user.joined",
  "workflow.stage_changed",
  "integration.test",
];

// ─── Retry Strategies ───────────────────────────────────────────────────

export type RetryStrategy = "exponential" | "linear" | "fixed";

export interface RetryConfig {
  strategy: RetryStrategy;
  maxAttempts: number;
  baseDelayMs: number;
}

const DEFAULT_RETRY: RetryConfig = { strategy: "exponential", maxAttempts: 3, baseDelayMs: 1000 };

export function computeRetryDelay(config: RetryConfig, attempt: number): number {
  switch (config.strategy) {
    case "exponential":
      return config.baseDelayMs * Math.pow(2, attempt - 1);
    case "linear":
      return config.baseDelayMs * attempt;
    case "fixed":
      return config.baseDelayMs;
    default:
      return config.baseDelayMs * Math.pow(2, attempt - 1);
  }
}

// ─── Payload Templates ──────────────────────────────────────────────────

export type PayloadFormat = "default" | "slack" | "teams" | "discord" | "custom";

export interface PayloadTemplate {
  format: PayloadFormat;
  customTemplate?: string; // JSON template with {{event}}, {{data}}, {{timestamp}} placeholders
}

export function formatPayload(
  event: WebhookEvent,
  data: Record<string, unknown>,
  template?: PayloadTemplate,
): string {
  const timestamp = new Date().toISOString();
  const defaultPayload = { event, data, timestamp };

  if (!template || template.format === "default") {
    return JSON.stringify(defaultPayload);
  }

  if (template.format === "custom" && template.customTemplate) {
    try {
      let result = template.customTemplate;
      result = result.replace(/\{\{event\}\}/g, event);
      result = result.replace(/\{\{timestamp\}\}/g, timestamp);
      result = result.replace(/\{\{data\}\}/g, JSON.stringify(data));
      // Validate it produces valid JSON
      JSON.parse(result);
      return result;
    } catch {
      return JSON.stringify(defaultPayload);
    }
  }

  // Platform-specific formats handled by integration adapters
  return JSON.stringify(defaultPayload);
}

// ─── Event Filtering ────────────────────────────────────────────────────

export function matchesEventFilter(event: WebhookEvent, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern === "*") return true;
    if (pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -2);
      return event.startsWith(prefix + ".");
    }
    return event === pattern;
  });
}

/**
 * Sign a payload string with HMAC-SHA256 using the webhook secret.
 */
export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify webhook signature using timing-safe comparison.
 */
export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const prefix = "sha256=";
  const sig = signature.startsWith(prefix) ? signature.slice(prefix.length) : signature;
  const expected = signPayload(payload, secret);
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sig, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB limit

/**
 * Fire a webhook event to all active webhooks that subscribe to it.
 * Supports event pattern matching (e.g., "project.*").
 */
export async function fireWebhookEvent(
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const activeWebhooks = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.active, true));

    const matching = activeWebhooks.filter((wh) => {
      const events: string[] = JSON.parse(wh.events);
      return matchesEventFilter(event, events);
    });

    if (matching.length === 0) return;

    for (const wh of matching) {
      const retryConfig = wh.retryConfig
        ? (JSON.parse(wh.retryConfig) as RetryConfig)
        : DEFAULT_RETRY;
      const payloadTemplate = wh.payloadTemplate
        ? (JSON.parse(wh.payloadTemplate) as PayloadTemplate)
        : undefined;

      const payload = formatPayload(event, data, payloadTemplate);
      const deliveryId = randomUUID();

      await db.insert(webhookDeliveries).values({
        id: deliveryId,
        webhookId: wh.id,
        event,
        payload,
        status: "pending",
        attempts: 0,
      });

      // Fire-and-forget delivery
      deliverWebhook(deliveryId, wh.url, wh.secret, payload, retryConfig).catch(() => {});
    }
  } catch (err) {
    logger.error({ err, event }, "Failed to fire webhook event");
  }
}

/**
 * Deliver a single webhook with configurable retry logic.
 */
export async function deliverWebhook(
  deliveryId: string,
  url: string,
  secret: string,
  payload: string,
  retryConfig: RetryConfig = DEFAULT_RETRY,
): Promise<void> {
  const maxAttempts = retryConfig.maxAttempts;

  // Enforce payload size limit
  if (Buffer.byteLength(payload, "utf-8") > MAX_PAYLOAD_SIZE) {
    logger.warn({ deliveryId, size: Buffer.byteLength(payload, "utf-8") }, "Webhook payload too large");
    await db
      .update(webhookDeliveries)
      .set({ status: "failed", responseBody: "Payload exceeds 1MB limit" })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const signature = signPayload(payload, secret);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": `sha256=${signature}`,
          "X-Webhook-Event": JSON.parse(payload).event ?? "unknown",
          "X-Webhook-Delivery": deliveryId,
        },
        body: payload,
        signal: AbortSignal.timeout(10000),
      });

      await db
        .update(webhookDeliveries)
        .set({
          attempts: attempt,
          lastAttemptAt: new Date(),
          responseStatus: response.status,
          responseBody: (await response.text()).slice(0, 1000),
          status: response.ok ? "success" : attempt === maxAttempts ? "failed" : "pending",
        })
        .where(eq(webhookDeliveries.id, deliveryId));

      if (response.ok) {
        logger.info({ deliveryId, url, attempt }, "Webhook delivered");
        return;
      }

      if (attempt === maxAttempts) {
        logger.error(
          { deliveryId, url, status: response.status, deadLetter: true },
          "Webhook delivery permanently failed",
        );
        return;
      }

      logger.warn(
        { deliveryId, url, attempt, status: response.status },
        "Webhook delivery failed, will retry",
      );
    } catch (err) {
      await db
        .update(webhookDeliveries)
        .set({
          attempts: attempt,
          lastAttemptAt: new Date(),
          status: attempt === maxAttempts ? "failed" : "pending",
          responseBody: err instanceof Error ? err.message.slice(0, 1000) : "Unknown error",
        })
        .where(eq(webhookDeliveries.id, deliveryId));

      if (attempt === maxAttempts) {
        logger.error(
          { deliveryId, url, err, deadLetter: true },
          "Webhook delivery permanently failed",
        );
        return;
      }

      logger.warn({ deliveryId, url, attempt, err }, "Webhook delivery error, retrying");
    }

    await new Promise((resolve) =>
      setTimeout(resolve, computeRetryDelay(retryConfig, attempt)),
    );
  }
}

/**
 * Get recent webhook deliveries for a given webhook, ordered by newest first.
 */
export async function getDeliveryLogs(
  webhookId: string,
  limit = 20,
): Promise<Array<{
  id: string;
  event: string;
  status: string;
  attempts: number;
  responseStatus: number | null;
  createdAt: Date | null;
}>> {
  return db
    .select({
      id: webhookDeliveries.id,
      event: webhookDeliveries.event,
      status: webhookDeliveries.status,
      attempts: webhookDeliveries.attempts,
      responseStatus: webhookDeliveries.responseStatus,
      createdAt: webhookDeliveries.createdAt,
    })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhookId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);
}

/**
 * Get delivery stats across all webhooks.
 */
export async function getDeliveryStats(): Promise<{
  total: number;
  success: number;
  failed: number;
  pending: number;
}> {
  const [stats] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      success: sql<number>`SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)`,
      failed: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
      pending: sql<number>`SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)`,
    })
    .from(webhookDeliveries);

  return {
    total: Number(stats?.total ?? 0),
    success: Number(stats?.success ?? 0),
    failed: Number(stats?.failed ?? 0),
    pending: Number(stats?.pending ?? 0),
  };
}

/**
 * Retry a failed delivery by re-delivering it.
 */
export async function retryDelivery(deliveryId: string): Promise<boolean> {
  const [delivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(and(eq(webhookDeliveries.id, deliveryId), eq(webhookDeliveries.status, "failed")))
    .limit(1);

  if (!delivery) return false;

  const [wh] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, delivery.webhookId))
    .limit(1);

  if (!wh) return false;

  // Reset delivery status
  await db
    .update(webhookDeliveries)
    .set({ status: "pending", attempts: 0, responseStatus: null, responseBody: null })
    .where(eq(webhookDeliveries.id, deliveryId));

  const retryConfig = wh.retryConfig
    ? (JSON.parse(wh.retryConfig) as RetryConfig)
    : DEFAULT_RETRY;

  deliverWebhook(deliveryId, wh.url, wh.secret, delivery.payload, retryConfig).catch(() => {});
  return true;
}

/**
 * Send a test event to a specific webhook.
 */
export async function testWebhook(webhookId: string): Promise<string> {
  const [wh] = await db.select().from(webhooks).where(eq(webhooks.id, webhookId)).limit(1);
  if (!wh) throw new Error("Webhook not found");

  const data = {
    message: "This is a test webhook delivery",
    webhookId: wh.id,
    testedAt: new Date().toISOString(),
  };

  const payloadTemplate = wh.payloadTemplate
    ? (JSON.parse(wh.payloadTemplate) as PayloadTemplate)
    : undefined;
  const payload = formatPayload("integration.test", data, payloadTemplate);
  const deliveryId = randomUUID();

  await db.insert(webhookDeliveries).values({
    id: deliveryId,
    webhookId: wh.id,
    event: "integration.test",
    payload,
    status: "pending",
    attempts: 0,
  });

  const retryConfig = wh.retryConfig
    ? (JSON.parse(wh.retryConfig) as RetryConfig)
    : DEFAULT_RETRY;

  deliverWebhook(deliveryId, wh.url, wh.secret, payload, retryConfig).catch(() => {});
  return deliveryId;
}
