import { db } from "@/db";
import { integrations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { WebhookEvent } from "@/lib/webhooks";
import { matchesEventFilter } from "@/lib/webhooks";
import { sendSlackMessage } from "./slack";
import { sendTeamsMessage } from "./teams";
import { sendDiscordMessage } from "./discord";
import { logger } from "@/lib/logger";

export type Platform = "slack" | "teams" | "discord";

const senders: Record<Platform, (url: string, event: WebhookEvent, data: Record<string, unknown>) => Promise<{ ok: boolean; status: number; body: string }>> = {
  slack: sendSlackMessage,
  teams: sendTeamsMessage,
  discord: sendDiscordMessage,
};

/**
 * Dispatch an event to all active platform integrations that subscribe to it.
 */
export async function dispatchToIntegrations(
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  try {
    const active = await db
      .select()
      .from(integrations)
      .where(eq(integrations.active, true));

    const matching = active.filter((integration) => {
      const events: string[] = JSON.parse(integration.events);
      return matchesEventFilter(event, events);
    });

    for (const integration of matching) {
      const sender = senders[integration.platform as Platform];
      if (!sender) {
        logger.warn({ platform: integration.platform }, "No sender for platform");
        failed++;
        continue;
      }

      try {
        const result = await sender(integration.webhookUrl, event, data);
        if (result.ok) {
          sent++;
        } else {
          logger.warn({ platform: integration.platform, status: result.status }, "Integration delivery failed");
          failed++;
        }
      } catch (err) {
        logger.error({ err, platform: integration.platform }, "Integration dispatch error");
        failed++;
      }
    }
  } catch (err) {
    logger.error({ err, event }, "Failed to dispatch integrations");
  }

  return { sent, failed };
}

/**
 * Test a specific integration by sending a test event.
 */
export async function testIntegration(integrationId: string): Promise<{ ok: boolean; status: number; body: string }> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, integrationId))
    .limit(1);

  if (!integration) {
    return { ok: false, status: 0, body: "Integration not found" };
  }

  const sender = senders[integration.platform as Platform];
  if (!sender) {
    return { ok: false, status: 0, body: `No sender for platform: ${integration.platform}` };
  }

  return sender(integration.webhookUrl, "integration.test", {
    message: "Test message from Ideate",
    integrationId: integration.id,
    platform: integration.platform,
    testedAt: new Date().toISOString(),
  });
}

export { sendSlackMessage } from "./slack";
export { sendTeamsMessage } from "./teams";
export { sendDiscordMessage } from "./discord";
export { formatSlackPayload } from "./slack";
export { formatTeamsCard } from "./teams";
export { formatDiscordPayload } from "./discord";
