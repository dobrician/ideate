/**
 * Smart Notification System — AI-powered notification filtering
 * and digest generation.
 *
 * Features:
 * - Per-user notification preferences (channel, category, frequency)
 * - Smart filtering: learn which notifications users care about
 * - Digest generation: daily/weekly summaries with prioritized content
 */

import { db } from "@/db";
import { notificationChannelPrefs as notificationPreferences } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "smart-notifications" });

export type NotificationChannel = "in_app" | "email" | "digest";
export type NotificationCategory = "votes" | "comments" | "proposals" | "ai_insights" | "system";

export interface NotificationPreference {
  id: string;
  userId: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  enabled: boolean;
  digestFrequency: "daily" | "weekly" | null;
  smartFilter: boolean;
}

export interface NotificationDigest {
  userId: string;
  period: "daily" | "weekly";
  items: DigestItem[];
  generatedAt: string;
}

export interface DigestItem {
  category: NotificationCategory;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  entityType?: string;
  entityId?: string;
  timestamp: string;
}

/**
 * Get notification preferences for a user.
 */
export async function getUserPreferences(userId: string): Promise<NotificationPreference[]> {
  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));

  return rows.map(r => ({
    ...r,
    channel: r.channel as NotificationChannel,
    category: r.category as NotificationCategory,
    enabled: Boolean(r.enabled),
    smartFilter: Boolean(r.smartFilter),
    digestFrequency: r.digestFrequency as "daily" | "weekly" | null,
  }));
}

/**
 * Update or create a notification preference.
 */
export async function upsertPreference(
  userId: string,
  channel: NotificationChannel,
  category: NotificationCategory,
  updates: {
    enabled?: boolean;
    digestFrequency?: "daily" | "weekly" | null;
    smartFilter?: boolean;
  }
): Promise<NotificationPreference> {
  // Check if exists
  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.channel, channel),
        eq(notificationPreferences.category, category)
      )
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(notificationPreferences)
      .set({
        enabled: updates.enabled ?? existing.enabled,
        digestFrequency: updates.digestFrequency !== undefined ? updates.digestFrequency : existing.digestFrequency,
        smartFilter: updates.smartFilter ?? existing.smartFilter,
      })
      .where(eq(notificationPreferences.id, existing.id))
      .returning();

    return {
      ...updated,
      channel: updated.channel as NotificationChannel,
      category: updated.category as NotificationCategory,
      enabled: Boolean(updated.enabled),
      smartFilter: Boolean(updated.smartFilter),
      digestFrequency: updated.digestFrequency as "daily" | "weekly" | null,
    };
  }

  const [created] = await db
    .insert(notificationPreferences)
    .values({
      userId,
      channel,
      category,
      enabled: updates.enabled ?? true,
      digestFrequency: updates.digestFrequency ?? null,
      smartFilter: updates.smartFilter ?? false,
    })
    .returning();

  return {
    ...created,
    channel: created.channel as NotificationChannel,
    category: created.category as NotificationCategory,
    enabled: Boolean(created.enabled),
    smartFilter: Boolean(created.smartFilter),
    digestFrequency: created.digestFrequency as "daily" | "weekly" | null,
  };
}

/**
 * Check if a notification should be delivered to a user.
 */
export async function shouldDeliver(
  userId: string,
  channel: NotificationChannel,
  category: NotificationCategory,
): Promise<boolean> {
  const [pref] = await db
    .select({ enabled: notificationPreferences.enabled })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.channel, channel),
        eq(notificationPreferences.category, category)
      )
    )
    .limit(1);

  // Default: deliver if no preference set
  if (!pref) return true;
  return Boolean(pref.enabled);
}

/**
 * Score notification importance (0-100) for smart filtering.
 * Higher score = more important = more likely to be shown.
 */
export function scoreNotification(item: DigestItem): number {
  let score = 50; // base score

  // Priority boost
  if (item.priority === "high") score += 30;
  else if (item.priority === "medium") score += 10;
  else score -= 10;

  // Category relevance
  if (item.category === "system") score += 10;
  if (item.category === "ai_insights") score += 5;

  // Recency boost
  const ageMs = Date.now() - new Date(item.timestamp).getTime();
  const ageHours = ageMs / (60 * 60 * 1000);
  if (ageHours < 1) score += 20;
  else if (ageHours < 6) score += 10;
  else if (ageHours > 48) score -= 15;

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate a digest of prioritized notifications.
 */
export function generateDigest(
  userId: string,
  period: "daily" | "weekly",
  items: DigestItem[],
): NotificationDigest {
  // Score and sort by importance
  const scored = items
    .map(item => ({ item, score: scoreNotification(item) }))
    .sort((a, b) => b.score - a.score);

  // Cap at reasonable limits
  const maxItems = period === "daily" ? 10 : 25;
  const filtered = scored.slice(0, maxItems).map(s => s.item);

  log.info(
    { userId, period, total: items.length, included: filtered.length },
    "Digest generated"
  );

  return {
    userId,
    period,
    items: filtered,
    generatedAt: new Date().toISOString(),
  };
}
