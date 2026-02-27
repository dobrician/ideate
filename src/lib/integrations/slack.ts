import type { WebhookEvent } from "@/lib/webhooks";
import { logger } from "@/lib/logger";

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: Array<{ type: string; text: string }>;
  elements?: Array<{ type: string; text: string }>;
}

export interface SlackPayload {
  text: string;
  blocks: SlackBlock[];
}

const EVENT_COLORS: Record<string, string> = {
  "project.created": "#2563eb",
  "project.updated": "#7c3aed",
  "project.archived": "#6b7280",
  "project.deadline": "#dc2626",
  "proposal.created": "#059669",
  "proposal.updated": "#0891b2",
  "proposal.status_changed": "#d97706",
  "vote.cast": "#8b5cf6",
  "comment.created": "#06b6d4",
  "user.joined": "#10b981",
  "workflow.stage_changed": "#f59e0b",
  "integration.test": "#6366f1",
};

function getEventEmoji(event: WebhookEvent): string {
  const emojiMap: Record<string, string> = {
    "project.created": ":rocket:",
    "project.updated": ":pencil2:",
    "project.archived": ":file_folder:",
    "project.deadline": ":alarm_clock:",
    "proposal.created": ":bulb:",
    "proposal.updated": ":memo:",
    "proposal.status_changed": ":arrows_counterclockwise:",
    "vote.cast": ":ballot_box_with_ballot:",
    "comment.created": ":speech_balloon:",
    "user.joined": ":wave:",
    "workflow.stage_changed": ":gear:",
    "integration.test": ":test_tube:",
  };
  return emojiMap[event] || ":bell:";
}

export function formatSlackPayload(
  event: WebhookEvent,
  data: Record<string, unknown>,
): SlackPayload {
  const emoji = getEventEmoji(event);
  const title = String(data.title || data.name || data.message || event);
  const fallback = `${emoji} [${event}] ${title}`;

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${event.replace(".", " ").toUpperCase()}`, emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `${emoji} *${title}*` },
    },
  ];

  // Add data fields
  const fields: Array<{ type: string; text: string }> = [];
  if (data.projectTitle) fields.push({ type: "mrkdwn", text: `*Project:* ${data.projectTitle}` });
  if (data.userName) fields.push({ type: "mrkdwn", text: `*By:* ${data.userName}` });
  if (data.status) fields.push({ type: "mrkdwn", text: `*Status:* ${data.status}` });
  if (data.description) {
    const desc = String(data.description).slice(0, 200);
    fields.push({ type: "mrkdwn", text: `*Description:* ${desc}` });
  }

  if (fields.length > 0) {
    blocks.push({ type: "section", fields });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `Sent from Ideate at ${new Date().toISOString()}` }],
  });

  return { text: fallback, blocks };
}

export async function sendSlackMessage(
  webhookUrl: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: string }> {
  const payload = formatSlackPayload(event, data);

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
    logger.error({ err, webhookUrl }, "Failed to send Slack message");
    return { ok: false, status: 0, body: err instanceof Error ? err.message : "Unknown error" };
  }
}
