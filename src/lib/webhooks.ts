import { db } from "@/db";
import { webhooks, webhookDeliveries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createHmac, randomUUID } from "crypto";
import { logger } from "@/lib/logger";

export type WebhookEvent =
  | "project.created"
  | "proposal.created"
  | "vote.cast"
  | "project.archived";

const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 1000; // 1s, 2s, 4s

/**
 * Sign a payload string with HMAC-SHA256 using the webhook secret.
 */
export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Fire a webhook event to all active webhooks that subscribe to it.
 * Non-blocking: queues deliveries and processes them asynchronously.
 */
export async function fireWebhookEvent(
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const activeWebhooks = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.active, true));

    const matching = activeWebhooks.filter((wh) => {
      const events: string[] = JSON.parse(wh.events);
      return events.includes(event);
    });

    if (matching.length === 0) return;

    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });

    for (const wh of matching) {
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
      deliverWebhook(deliveryId, wh.url, wh.secret, payload).catch(() => {});
    }
  } catch (err) {
    logger.error({ err, event }, "Failed to fire webhook event");
  }
}

/**
 * Deliver a single webhook with retry logic (3 attempts, exponential backoff).
 */
export async function deliverWebhook(
  deliveryId: string,
  url: string,
  secret: string,
  payload: string
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const signature = signPayload(payload, secret);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": `sha256=${signature}`,
          "X-Webhook-Event": JSON.parse(payload).event,
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
          status: response.ok ? "success" : attempt === MAX_ATTEMPTS ? "failed" : "pending",
        })
        .where(eq(webhookDeliveries.id, deliveryId));

      if (response.ok) {
        logger.info({ deliveryId, url, attempt }, "Webhook delivered");
        return;
      }

      if (attempt === MAX_ATTEMPTS) {
        logger.error(
          { deliveryId, url, status: response.status, deadLetter: true },
          "Webhook delivery permanently failed"
        );
        return;
      }

      logger.warn(
        { deliveryId, url, attempt, status: response.status },
        "Webhook delivery failed, will retry"
      );
    } catch (err) {
      await db
        .update(webhookDeliveries)
        .set({
          attempts: attempt,
          lastAttemptAt: new Date(),
          status: attempt === MAX_ATTEMPTS ? "failed" : "pending",
          responseBody: err instanceof Error ? err.message.slice(0, 1000) : "Unknown error",
        })
        .where(eq(webhookDeliveries.id, deliveryId));

      if (attempt === MAX_ATTEMPTS) {
        logger.error(
          { deliveryId, url, err, deadLetter: true },
          "Webhook delivery permanently failed"
        );
        return;
      }

      logger.warn({ deliveryId, url, attempt, err }, "Webhook delivery error, retrying");
    }

    // Exponential backoff
    await new Promise((resolve) =>
      setTimeout(resolve, BACKOFF_BASE_MS * Math.pow(2, attempt - 1))
    );
  }
}
