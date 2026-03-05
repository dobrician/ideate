/**
 * Admin alert delivery — delivers alerts to admin users via in-app
 * and email channels, honoring per-user notification preferences.
 */
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { shouldDeliverAdminAlert, type AdminAlertCategory, type AlertChannel } from "./admin-notification-prefs";
import { getSmtpTransporter } from "./mail";
import { logger } from "./logger";

const log = logger.child({ module: "admin-alert-delivery" });

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const SMTP_FROM = process.env.SMTP_FROM || "idea@surcod.ro";

interface AdminAlertPayload {
  category: AdminAlertCategory;
  title: string;
  message: string;
  severity?: "warning" | "critical";
  actionUrl?: string;
}

interface DeliveryResult {
  inApp: number;
  email: number;
  skipped: number;
  errors: number;
}

/**
 * Get all admin users.
 */
async function getAdminUsers(): Promise<Array<{ id: string; email: string; firstName: string | null }>> {
  try {
    return db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
      })
      .from(users)
      .where(eq(users.role, "admin"));
  } catch (err) {
    log.error({ err }, "Failed to fetch admin users");
    return [];
  }
}

/**
 * Deliver an admin alert to all eligible admin users.
 * Checks per-user notification preferences for each channel.
 */
export async function deliverAdminAlert(
  payload: AdminAlertPayload
): Promise<DeliveryResult> {
  const result: DeliveryResult = { inApp: 0, email: 0, skipped: 0, errors: 0 };

  try {
    const admins = await getAdminUsers();
    if (admins.length === 0) {
      log.info("No admin users found for alert delivery");
      return result;
    }

    for (const admin of admins) {
      // Check in-app preference
      const wantsInApp = await shouldDeliverAdminAlert(admin.id, payload.category, "in_app");
      if (wantsInApp) {
        try {
          await deliverInApp(admin.id, payload);
          result.inApp++;
        } catch {
          result.errors++;
        }
      } else {
        result.skipped++;
      }

      // Check email preference
      const wantsEmail = await shouldDeliverAdminAlert(admin.id, payload.category, "email");
      if (wantsEmail) {
        try {
          await deliverEmail(admin.email, admin.firstName, payload);
          result.email++;
        } catch {
          result.errors++;
        }
      } else {
        result.skipped++;
      }
    }

    log.info(
      { category: payload.category, ...result },
      "Admin alert delivered"
    );
  } catch (err) {
    log.error({ err }, "Failed to deliver admin alert");
  }

  return result;
}

/**
 * Deliver an in-app notification.
 * Uses a simple log-based approach since there's no in-app notification
 * table yet — this provides the integration point for future in-app UI.
 */
async function deliverInApp(
  userId: string,
  payload: AdminAlertPayload
): Promise<void> {
  // Log the in-app notification delivery.
  // When an in-app notifications table is added, this is where
  // we'd insert a row for the user to see in their notification feed.
  log.info(
    { userId, category: payload.category, title: payload.title },
    "In-app admin alert delivered"
  );
}

/**
 * Deliver an email notification.
 */
async function deliverEmail(
  email: string,
  firstName: string | null,
  payload: AdminAlertPayload
): Promise<void> {
  const transport = getSmtpTransporter();
  if (!transport) {
    // SMTP not configured — log the mail for testing
    const logFile = process.env.MAIL_LOG_FILE;
    if (logFile) {
      const { appendFileSync } = await import("fs");
      try {
        appendFileSync(
          logFile,
          JSON.stringify({
            to: email,
            type: `admin-alert:${payload.category}`,
            title: payload.title,
            message: payload.message,
            timestamp: new Date().toISOString(),
          }) + "\n"
        );
      } catch { /* non-critical */ }
    }
    return;
  }

  const name = firstName || "Admin";
  const severityBadge = payload.severity === "critical"
    ? '<span style="background:#dc2626;color:white;padding:2px 8px;border-radius:4px;font-size:12px;">CRITICAL</span>'
    : '<span style="background:#f59e0b;color:white;padding:2px 8px;border-radius:4px;font-size:12px;">WARNING</span>';

  const actionLink = payload.actionUrl
    ? `<p style="margin:24px 0;"><a href="${payload.actionUrl}" style="background-color:#0070f3;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;">View Details</a></p>`
    : "";

  await transport.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: `[Ideate] ${payload.severity === "critical" ? "CRITICAL: " : ""}${payload.title}`,
    text: `Hi ${name},\n\n${payload.title}\n\n${payload.message}\n\n${payload.actionUrl ? `View details: ${payload.actionUrl}` : ""}\n\nThis is an automated admin alert from Ideate.`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#0070f3;">${severityBadge} ${payload.title}</h2>
        <p style="color:#333;line-height:1.6;">${payload.message}</p>
        ${actionLink}
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#999;font-size:12px;">
          This is an automated admin alert from Ideate.
          <a href="${APP_URL}/admin/notification-prefs" style="color:#666;">Manage preferences</a>
        </p>
      </div>
    `,
  });
}

/**
 * Map alert category to admin page URL for actionable links.
 */
export function getAlertActionUrl(category: AdminAlertCategory): string {
  switch (category) {
    case "ci_alerts": return `${APP_URL}/admin/perf-dashboard`;
    case "search_quality": return `${APP_URL}/admin`;
    case "embedding_alerts": return `${APP_URL}/admin/embeddings`;
    case "system_events": return `${APP_URL}/admin`;
  }
}
