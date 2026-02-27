import type { WebhookEvent } from "@/lib/webhooks";
import { logger } from "@/lib/logger";

export interface TeamsCard {
  type: string;
  attachments: Array<{
    contentType: string;
    content: {
      "$schema": string;
      type: string;
      version: string;
      body: Array<Record<string, unknown>>;
    };
  }>;
}

function getEventColor(event: WebhookEvent): string {
  const colors: Record<string, string> = {
    "project.created": "Accent",
    "project.archived": "Default",
    "project.deadline": "Attention",
    "proposal.created": "Good",
    "vote.cast": "Accent",
    "comment.created": "Default",
    "user.joined": "Good",
    "integration.test": "Accent",
  };
  return colors[event] || "Default";
}

export function formatTeamsCard(
  event: WebhookEvent,
  data: Record<string, unknown>,
): TeamsCard {
  const title = String(data.title || data.name || data.message || event);
  const color = getEventColor(event);

  const body: Array<Record<string, unknown>> = [
    {
      type: "TextBlock",
      size: "Medium",
      weight: "Bolder",
      text: event.replace(".", " ").toUpperCase(),
      style: color,
    },
    {
      type: "TextBlock",
      text: title,
      wrap: true,
    },
  ];

  // Add facts
  const facts: Array<{ title: string; value: string }> = [];
  if (data.projectTitle) facts.push({ title: "Project", value: String(data.projectTitle) });
  if (data.userName) facts.push({ title: "By", value: String(data.userName) });
  if (data.status) facts.push({ title: "Status", value: String(data.status) });

  if (facts.length > 0) {
    body.push({
      type: "FactSet",
      facts,
    });
  }

  if (data.description) {
    body.push({
      type: "TextBlock",
      text: String(data.description).slice(0, 300),
      wrap: true,
      isSubtle: true,
      size: "Small",
    });
  }

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body,
        },
      },
    ],
  };
}

export async function sendTeamsMessage(
  webhookUrl: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: string }> {
  const card = formatTeamsCard(event, data);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
      signal: AbortSignal.timeout(10000),
    });

    const body = await response.text();
    return { ok: response.ok, status: response.status, body: body.slice(0, 500) };
  } catch (err) {
    logger.error({ err, webhookUrl }, "Failed to send Teams message");
    return { ok: false, status: 0, body: err instanceof Error ? err.message : "Unknown error" };
  }
}
