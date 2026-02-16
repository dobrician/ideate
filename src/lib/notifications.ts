/**
 * Email notification system for proposal owners.
 * Debounces notifications to avoid spam (max 1 per proposal per 15 min).
 */

import { db } from "@/db";
import { proposals, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { escapeHtml } from "@/lib/sanitize";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || "idea@surcod.ro";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

// Debounce: track last notification time per proposal
const lastNotification = new Map<string, number>();
const DEBOUNCE_MS = 15 * 60 * 1000; // 15 minutes

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * Check if notification should be sent (debounce check)
 */
function shouldNotify(proposalId: string, type: string): boolean {
  const key = `${proposalId}:${type}`;
  const last = lastNotification.get(key);
  const now = Date.now();

  if (last && now - last < DEBOUNCE_MS) return false;

  lastNotification.set(key, now);
  return true;
}

/**
 * Notify proposal owner about a new vote
 */
export async function notifyVote(
  proposalId: string,
  projectId: string,
  voterUserId: string,
  voteValue: number
): Promise<void> {
  try {
    if (!shouldNotify(proposalId, "vote")) return;

    const transport = getTransporter();
    if (!transport) return;

    const proposal = await db
      .select({
        title: proposals.title,
        userId: proposals.userId,
      })
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal[0]?.userId || proposal[0].userId === voterUserId) return;

    const owner = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, proposal[0].userId))
      .limit(1);

    if (!owner[0]) return;

    const voteType = voteValue === 1 ? "upvoted" : "downvoted";
    const projectUrl = `${APP_URL}/projects/${projectId}`;

    await transport.sendMail({
      from: SMTP_FROM,
      to: owner[0].email,
      subject: `Your proposal "${proposal[0].title}" was ${voteType}`,
      text: `Someone ${voteType} your proposal "${proposal[0].title}".\n\nView it here: ${projectUrl}`,
      html: `
        <p>Hi ${escapeHtml(owner[0].firstName || "there")},</p>
        <p>Someone <strong>${voteType}</strong> your proposal "<strong>${escapeHtml(proposal[0].title)}</strong>".</p>
        <p><a href="${projectUrl}" style="color:#0070f3;">View Project</a></p>
        <p style="color:#999;font-size:12px;">You received this because you own this proposal on Ideate.</p>
      `,
    });
  } catch {
    // Notifications should never break application flow
  }
}

/**
 * Notify proposal owner about a new comment
 */
export async function notifyComment(
  proposalId: string,
  projectId: string,
  commenterUserId: string,
  commentContent: string
): Promise<void> {
  try {
    if (!shouldNotify(proposalId, "comment")) return;

    const transport = getTransporter();
    if (!transport) return;

    const proposal = await db
      .select({
        title: proposals.title,
        userId: proposals.userId,
      })
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal[0]?.userId || proposal[0].userId === commenterUserId) return;

    const owner = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, proposal[0].userId))
      .limit(1);

    if (!owner[0]) return;

    const projectUrl = `${APP_URL}/projects/${projectId}`;
    const preview =
      commentContent.length > 100
        ? commentContent.substring(0, 100) + "..."
        : commentContent;

    await transport.sendMail({
      from: SMTP_FROM,
      to: owner[0].email,
      subject: `New comment on "${proposal[0].title}"`,
      text: `Someone commented on your proposal "${proposal[0].title}":\n\n"${preview}"\n\nView it here: ${projectUrl}`,
      html: `
        <p>Hi ${escapeHtml(owner[0].firstName || "there")},</p>
        <p>Someone commented on your proposal "<strong>${escapeHtml(proposal[0].title)}</strong>":</p>
        <blockquote style="border-left:3px solid #e0e0e0;padding-left:12px;color:#666;">${escapeHtml(preview)}</blockquote>
        <p><a href="${projectUrl}" style="color:#0070f3;">View Project</a></p>
        <p style="color:#999;font-size:12px;">You received this because you own this proposal on Ideate.</p>
      `,
    });
  } catch {
    // Notifications should never break application flow
  }
}
