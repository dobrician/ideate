/**
 * Weekly digest email generation.
 * Aggregates new projects, top proposals, and activity stats
 * from the past 7 days and sends HTML digest to subscribers.
 */

import { db } from "@/db";
import {
  users,
  projects,
  proposals,
  votes,
  comments,
  notificationPreferences,
} from "@/db/schema";
import { sql, eq, gte } from "drizzle-orm";
import { escapeHtml } from "@/lib/sanitize";
import { getSmtpTransporter } from "@/lib/mail";
import { getTranslations } from "@/lib/i18n";
import { logger } from "@/lib/logger";

const SMTP_FROM = process.env.SMTP_FROM || "idea@surcod.ro";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

export interface DigestData {
  newProjects: { id: string; title: string; createdAt: Date | null }[];
  topProposals: {
    id: string;
    title: string;
    projectId: string;
    voteCount: number;
  }[];
  stats: {
    projectsCreated: number;
    proposalsSubmitted: number;
    votesCast: number;
    commentsPosted: number;
  };
}

/**
 * Gather digest data for the past 7 days.
 */
export async function gatherDigestData(): Promise<DigestData> {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const newProjects = await db
    .select({
      id: projects.id,
      title: projects.title,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(gte(projects.createdAt, oneWeekAgo))
    .orderBy(sql`${projects.createdAt} DESC`)
    .limit(10);

  const topProposals = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      projectId: proposals.projectId,
      voteCount: sql<number>`COALESCE(SUM(${votes.value}), 0)`,
    })
    .from(proposals)
    .leftJoin(votes, eq(proposals.id, votes.proposalId))
    .where(gte(proposals.createdAt, oneWeekAgo))
    .groupBy(proposals.id)
    .orderBy(sql`COALESCE(SUM(${votes.value}), 0) DESC`)
    .limit(5);

  const [projectCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(projects)
    .where(gte(projects.createdAt, oneWeekAgo));

  const [proposalCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(proposals)
    .where(gte(proposals.createdAt, oneWeekAgo));

  const [voteCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(votes)
    .where(gte(votes.createdAt, oneWeekAgo));

  const [commentCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(comments)
    .where(gte(comments.createdAt, oneWeekAgo));

  return {
    newProjects,
    topProposals: topProposals.map((p) => ({
      ...p,
      voteCount: Number(p.voteCount),
    })),
    stats: {
      projectsCreated: Number(projectCount.count),
      proposalsSubmitted: Number(proposalCount.count),
      votesCast: Number(voteCount.count),
      commentsPosted: Number(commentCount.count),
    },
  };
}

/**
 * Get all users who have opted in to the weekly digest.
 */
export async function getDigestSubscribers(): Promise<
  { id: string; email: string; firstName: string | null }[]
> {
  const subscribers = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
    })
    .from(users)
    .innerJoin(
      notificationPreferences,
      eq(users.id, notificationPreferences.userId)
    )
    .where(eq(notificationPreferences.emailWeeklyDigest, true));

  return subscribers;
}

/**
 * Generate HTML email body for the digest.
 */
export function generateDigestHtml(data: DigestData): string {
  const { t } = getTranslations();

  const projectsListHtml =
    data.newProjects.length > 0
      ? data.newProjects
          .map(
            (p) =>
              `<li><a href="${APP_URL}/projects/${p.id}" style="color:#0070f3;text-decoration:none;">${escapeHtml(p.title)}</a></li>`
          )
          .join("")
      : `<li style="color:#666;">${t("digest.noActivity")}</li>`;

  const proposalsListHtml =
    data.topProposals.length > 0
      ? data.topProposals
          .map(
            (p) =>
              `<li><a href="${APP_URL}/projects/${p.projectId}" style="color:#0070f3;text-decoration:none;">${escapeHtml(p.title)}</a> <span style="color:#666;">(${t("digest.votes", { count: p.voteCount })})</span></li>`
          )
          .join("")
      : `<li style="color:#666;">${t("digest.noActivity")}</li>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <h1 style="color:#0070f3;margin-bottom:24px;">${t("digest.subject")}</h1>

  <div style="margin-bottom:24px;padding:16px;background:#f9fafb;border-radius:8px;">
    <h3 style="margin:0 0 8px;">${t("digest.activityStats")}</h3>
    <p style="margin:4px 0;">${t("digest.projectsCreated", { count: data.stats.projectsCreated })}</p>
    <p style="margin:4px 0;">${t("digest.proposalsSubmitted", { count: data.stats.proposalsSubmitted })}</p>
    <p style="margin:4px 0;">${t("digest.votesCast", { count: data.stats.votesCast })}</p>
    <p style="margin:4px 0;">${t("digest.commentsPosted", { count: data.stats.commentsPosted })}</p>
  </div>

  <h2 style="margin-bottom:8px;">${t("digest.newProjects")}</h2>
  <ul style="padding-left:20px;">${projectsListHtml}</ul>

  <h2 style="margin-bottom:8px;">${t("digest.topProposals")}</h2>
  <ul style="padding-left:20px;">${proposalsListHtml}</ul>

  <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
  <p style="color:#999;font-size:12px;">You received this because you opted into the weekly digest on <a href="${APP_URL}" style="color:#0070f3;">Ideate</a>. Update your preferences in your profile settings.</p>
</body>
</html>`;
}

/**
 * Send the weekly digest to all subscribers.
 * Returns the number of emails sent.
 */
export async function sendDigestEmails(): Promise<number> {
  const transport = getSmtpTransporter();
  if (!transport) {
    logger.warn("SMTP not configured, skipping digest");
    return 0;
  }

  const { t } = getTranslations();
  const subscribers = await getDigestSubscribers();

  if (subscribers.length === 0) {
    logger.info(t("digest.noSubscribers"));
    return 0;
  }

  const data = await gatherDigestData();
  const html = generateDigestHtml(data);

  let sent = 0;
  for (const subscriber of subscribers) {
    try {
      await transport.sendMail({
        from: SMTP_FROM,
        to: subscriber.email,
        subject: t("digest.subject"),
        html,
      });
      sent++;
    } catch (err) {
      logger.error(
        { err, email: subscriber.email },
        "Failed to send digest email"
      );
    }
  }

  logger.info({ sent, total: subscribers.length }, t("digest.sent"));
  return sent;
}
