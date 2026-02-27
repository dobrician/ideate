import type { WebhookEvent } from "@/lib/webhooks";
import { logger } from "@/lib/logger";

export interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

export interface DiscordPayload {
  content: string;
  embeds: DiscordEmbed[];
}

const EVENT_COLORS: Record<string, number> = {
  "project.created": 0x2563eb,
  "project.updated": 0x7c3aed,
  "project.archived": 0x6b7280,
  "project.deadline": 0xdc2626,
  "proposal.created": 0x059669,
  "proposal.updated": 0x0891b2,
  "proposal.status_changed": 0xd97706,
  "vote.cast": 0x8b5cf6,
  "comment.created": 0x06b6d4,
  "user.joined": 0x10b981,
  "workflow.stage_changed": 0xf59e0b,
  "integration.test": 0x6366f1,
};

export function formatDiscordPayload(
  event: WebhookEvent,
  data: Record<string, unknown>,
): DiscordPayload {
  const title = String(data.title || data.name || data.message || event);
  const color = EVENT_COLORS[event] || 0x6366f1;

  const fields: Array<{ name: string; value: string; inline: boolean }> = [];
  if (data.projectTitle) fields.push({ name: "Project", value: String(data.projectTitle), inline: true });
  if (data.userName) fields.push({ name: "By", value: String(data.userName), inline: true });
  if (data.status) fields.push({ name: "Status", value: String(data.status), inline: true });

  const embed: DiscordEmbed = {
    title: `${event.replace(".", " ").toUpperCase()}`,
    description: title,
    color,
    fields: fields.length > 0 ? fields : undefined,
    footer: { text: "Ideate Notifications" },
    timestamp: new Date().toISOString(),
  };

  if (data.description) {
    embed.description = `${title}\n\n${String(data.description).slice(0, 300)}`;
  }

  return {
    content: `**[${event}]** ${title}`,
    embeds: [embed],
  };
}

export async function sendDiscordMessage(
  webhookUrl: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: string }> {
  const payload = formatDiscordPayload(event, data);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const body = await response.text();
    return { ok: response.ok, status: response.status, body: body.slice(0, 500) };
  } catch (err) {
    logger.error({ err, webhookUrl }, "Failed to send Discord message");
    return { ok: false, status: 0, body: err instanceof Error ? err.message : "Unknown error" };
  }
}
