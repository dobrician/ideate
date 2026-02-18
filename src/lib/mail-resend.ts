/**
 * Resend HTTP email transport for Cloudflare Workers deployment.
 *
 * When DEPLOY_TARGET=cloudflare, nodemailer is unavailable (no net/tls).
 * This module sends emails via Resend's REST API instead.
 *
 * Requires RESEND_API_KEY environment variable.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

interface ResendPayload {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Send an email via Resend's HTTP API.
 * Throws on failure with a descriptive error message.
 */
export async function sendViaResend(payload: ResendPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required for Cloudflare deployment");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }
}

/** Check if Resend is configured (RESEND_API_KEY is set). */
export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
