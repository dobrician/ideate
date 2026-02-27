"use server";

import { withActionAuth } from "@/lib/action-wrapper";
import { logAudit } from "@/lib/audit";
import { db } from "@/db";
import { aiModels, aiFeedback, aiInsights } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { submitFeedback, type FeedbackInput, type AIFeature, getAllFeatureStats } from "@/lib/ai/learning";
import { dismissInsight, getInsightSummary } from "@/lib/ai/insights";
import { upsertPreference, type NotificationChannel, type NotificationCategory } from "@/lib/ai/notifications";

// ─── AI Feedback Actions ────────────────────────────────────────────────

export async function submitAiFeedbackAction(
  csrfToken: string,
  input: Omit<FeedbackInput, "userId">
) {
  return withActionAuth(csrfToken, {}, async (user) => {
    if (!input.feature || !input.entityType || !input.entityId || !input.rating) {
      return { error: "Missing required fields" };
    }
    if (input.rating < 1 || input.rating > 5) {
      return { error: "Rating must be 1-5" };
    }

    const id = await submitFeedback({ ...input, userId: user.id });

    await logAudit({
      userId: user.id,
      action: "ai_feedback.submit",
      entity: "ai_feedback",
      entityId: id,
      details: JSON.stringify({ feature: input.feature, rating: input.rating }),
    });

    return { success: true, id };
  });
}

export async function getAiFeedbackStatsAction(csrfToken: string) {
  return withActionAuth(csrfToken, { permission: "user:manage" }, async () => {
    const stats = await getAllFeatureStats();
    return { success: true, stats };
  });
}

// ─── AI Model Actions ───────────────────────────────────────────────────

export async function createAiModelAction(
  csrfToken: string,
  input: { name: string; feature: string; version: string; provider: string; config?: string }
) {
  return withActionAuth(csrfToken, { permission: "user:manage" }, async (user) => {
    if (!input.name || input.name.length > 255) return { error: "Invalid name" };
    if (!input.feature) return { error: "Feature is required" };
    if (!input.version) return { error: "Version is required" };
    if (!["gemini", "openai", "local"].includes(input.provider)) return { error: "Invalid provider" };

    if (input.config) {
      try { JSON.parse(input.config); } catch { return { error: "Invalid JSON config" }; }
    }

    const [model] = await db
      .insert(aiModels)
      .values({
        name: input.name.slice(0, 255),
        feature: input.feature,
        version: input.version,
        provider: input.provider as "gemini" | "openai" | "local",
        config: input.config ?? null,
      })
      .returning();

    await logAudit({
      userId: user.id,
      action: "ai_model.create",
      entity: "ai_model",
      entityId: model.id,
      details: JSON.stringify({ name: input.name, feature: input.feature, version: input.version }),
    });

    return { success: true, model };
  });
}

export async function updateAiModelStatusAction(
  csrfToken: string,
  modelId: string,
  status: "active" | "inactive" | "testing"
) {
  return withActionAuth(csrfToken, { permission: "user:manage" }, async (user) => {
    if (!modelId) return { error: "Model ID required" };
    if (!["active", "inactive", "testing"].includes(status)) return { error: "Invalid status" };

    await db.update(aiModels).set({ status }).where(eq(aiModels.id, modelId));

    await logAudit({
      userId: user.id,
      action: "ai_model.update",
      entity: "ai_model",
      entityId: modelId,
      details: JSON.stringify({ status }),
    });

    return { success: true };
  });
}

export async function getAiModelsAction(csrfToken: string) {
  return withActionAuth(csrfToken, { permission: "user:manage" }, async () => {
    const models = await db
      .select()
      .from(aiModels)
      .orderBy(desc(aiModels.createdAt));

    return { success: true, models };
  });
}

// ─── AI Insights Actions ────────────────────────────────────────────────

export async function dismissInsightAction(csrfToken: string, insightId: string) {
  return withActionAuth(csrfToken, {}, async (user) => {
    if (!insightId) return { error: "Insight ID required" };

    await dismissInsight(insightId, user.id);

    await logAudit({
      userId: user.id,
      action: "ai_insight.dismiss",
      entity: "ai_insight",
      entityId: insightId,
    });

    return { success: true };
  });
}

export async function getInsightSummaryAction(csrfToken: string) {
  return withActionAuth(csrfToken, { permission: "user:manage" }, async () => {
    const summary = await getInsightSummary();
    return { success: true, summary };
  });
}

// ─── Notification Preference Actions ────────────────────────────────────

export async function updateNotificationPreferenceAction(
  csrfToken: string,
  channel: string,
  category: string,
  updates: { enabled?: boolean; digestFrequency?: "daily" | "weekly" | null; smartFilter?: boolean }
) {
  return withActionAuth(csrfToken, {}, async (user) => {
    const validChannels = ["in_app", "email", "digest"];
    const validCategories = ["votes", "comments", "proposals", "ai_insights", "system"];

    if (!validChannels.includes(channel)) return { error: "Invalid channel" };
    if (!validCategories.includes(category)) return { error: "Invalid category" };

    const pref = await upsertPreference(
      user.id,
      channel as NotificationChannel,
      category as NotificationCategory,
      updates
    );

    await logAudit({
      userId: user.id,
      action: "notification_pref.update",
      entity: "notification_preference",
      details: JSON.stringify({ channel, category, ...updates }),
    });

    return { success: true, preference: pref };
  });
}
