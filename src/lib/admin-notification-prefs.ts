/**
 * Admin notification preferences — per-user alert preferences for CI,
 * search quality, embedding, and system events.
 *
 * Extends the existing notificationChannelPrefs table with admin-specific
 * alert categories. These preferences control which admin alerts a user
 * receives via in-app notifications or email.
 */
import { db } from "@/db";
import { notificationChannelPrefs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "admin-notification-prefs" });

/** Admin alert categories */
export type AdminAlertCategory = "ci_alerts" | "search_quality" | "embedding_alerts" | "system_events";
export type AlertChannel = "in_app" | "email";

export interface AdminAlertPreference {
  category: AdminAlertCategory;
  channel: AlertChannel;
  enabled: boolean;
}

/** Default admin alert preferences — all enabled by default */
const DEFAULT_CATEGORIES: AdminAlertCategory[] = [
  "ci_alerts",
  "search_quality",
  "embedding_alerts",
  "system_events",
];

const DEFAULT_CHANNELS: AlertChannel[] = ["in_app", "email"];

/**
 * Get admin notification preferences for a user.
 * Returns all category/channel combinations with their enabled status.
 * Missing preferences default to enabled.
 */
export async function getAdminAlertPreferences(
  userId: string
): Promise<AdminAlertPreference[]> {
  try {
    const rows = await db
      .select({
        category: notificationChannelPrefs.category,
        channel: notificationChannelPrefs.channel,
        enabled: notificationChannelPrefs.enabled,
      })
      .from(notificationChannelPrefs)
      .where(eq(notificationChannelPrefs.userId, userId));

    // Build a map of stored preferences
    const stored = new Map<string, boolean>();
    for (const row of rows) {
      stored.set(`${row.category}:${row.channel}`, Boolean(row.enabled));
    }

    // Build full preference list with defaults for missing entries
    const result: AdminAlertPreference[] = [];
    for (const category of DEFAULT_CATEGORIES) {
      for (const channel of DEFAULT_CHANNELS) {
        const key = `${category}:${channel}`;
        result.push({
          category,
          channel,
          enabled: stored.has(key) ? stored.get(key)! : true, // default: enabled
        });
      }
    }

    return result;
  } catch (err) {
    log.warn({ err, userId }, "Failed to get admin alert preferences");
    // Return all-enabled defaults on error
    return DEFAULT_CATEGORIES.flatMap((category) =>
      DEFAULT_CHANNELS.map((channel) => ({ category, channel, enabled: true }))
    );
  }
}

/**
 * Update a single admin alert preference.
 * Creates the preference if it doesn't exist.
 */
export async function updateAdminAlertPreference(
  userId: string,
  category: AdminAlertCategory,
  channel: AlertChannel,
  enabled: boolean
): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: notificationChannelPrefs.id })
      .from(notificationChannelPrefs)
      .where(
        and(
          eq(notificationChannelPrefs.userId, userId),
          eq(notificationChannelPrefs.category, category),
          eq(notificationChannelPrefs.channel, channel)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(notificationChannelPrefs)
        .set({ enabled, updatedAt: new Date() })
        .where(eq(notificationChannelPrefs.id, existing.id));
    } else {
      await db.insert(notificationChannelPrefs).values({
        userId,
        category,
        channel,
        enabled,
      });
    }

    log.info({ userId, category, channel, enabled }, "Admin alert preference updated");
  } catch (err) {
    log.error({ err, userId, category, channel }, "Failed to update admin alert preference");
    throw err;
  }
}

/**
 * Check if an admin alert should be delivered for a given user + category + channel.
 * Returns true if the preference is enabled or doesn't exist (default: enabled).
 */
export async function shouldDeliverAdminAlert(
  userId: string,
  category: AdminAlertCategory,
  channel: AlertChannel
): Promise<boolean> {
  try {
    const [pref] = await db
      .select({ enabled: notificationChannelPrefs.enabled })
      .from(notificationChannelPrefs)
      .where(
        and(
          eq(notificationChannelPrefs.userId, userId),
          eq(notificationChannelPrefs.category, category),
          eq(notificationChannelPrefs.channel, channel)
        )
      )
      .limit(1);

    // Default: deliver if no preference set
    return pref ? Boolean(pref.enabled) : true;
  } catch {
    return true; // fail-open
  }
}
