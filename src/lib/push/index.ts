/**
 * Web Push notification management.
 * VAPID key pair management, subscription storage, and notification dispatch.
 */
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  actions?: Array<{ action: string; title: string }>;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Store a push subscription for a user.
 */
export async function saveSubscription(
  userId: string,
  subscription: PushSubscriptionData,
): Promise<void> {
  // Upsert: remove old subscription for same endpoint, then insert
  await db.delete(pushSubscriptions).where(
    and(
      eq(pushSubscriptions.userId, userId),
      eq(pushSubscriptions.endpoint, subscription.endpoint),
    ),
  );
  await db.insert(pushSubscriptions).values({
    userId,
    endpoint: subscription.endpoint,
    p256dhKey: subscription.keys.p256dh,
    authKey: subscription.keys.auth,
  });
}

/**
 * Remove a push subscription.
 */
export async function removeSubscription(
  userId: string,
  endpoint: string,
): Promise<void> {
  await db.delete(pushSubscriptions).where(
    and(
      eq(pushSubscriptions.userId, userId),
      eq(pushSubscriptions.endpoint, endpoint),
    ),
  );
}

/**
 * Get all subscriptions for a user.
 */
export async function getUserSubscriptions(userId: string) {
  return db.select().from(pushSubscriptions).where(
    eq(pushSubscriptions.userId, userId),
  );
}

/**
 * Build a push notification payload.
 */
export function buildPushPayload(
  type: "proposal" | "vote" | "comment" | "project",
  title: string,
  body: string,
  url?: string,
): PushPayload {
  const tagMap = {
    proposal: "ideate-proposal",
    vote: "ideate-vote",
    comment: "ideate-comment",
    project: "ideate-project",
  };

  return {
    title,
    body,
    url: url || "/",
    tag: tagMap[type],
  };
}

/**
 * Get VAPID public key for client subscription.
 * Returns the public key from env or null if not configured.
 */
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/**
 * Check if push notifications are configured on the server.
 */
export function isPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
