"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { users, notificationPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { withActionAuth } from "@/lib/action-wrapper";

/**
 * Complete onboarding — save name and mark onboarding as done
 */
export async function completeOnboarding(formData: FormData) {
  return withActionAuth(formData.get("csrfToken") as string, {
    rateLimitKey: "profile:onboarding",
    rateLimitMax: 10,
  }, async (user) => {
    const firstName = ((formData.get("firstName") as string) || "").trim().slice(0, 100) || null;
    const lastName = ((formData.get("lastName") as string) || "").trim().slice(0, 100) || null;

    await db
      .update(users)
      .set({
        firstName,
        lastName,
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await logAudit({
      userId: user.id,
      action: "complete_onboarding",
      entity: "user",
      entityId: user.id,
    });

    revalidatePath("/");
    return { success: true };
  });
}

const profileSchema = z.object({
  firstName: z.string().max(100, "First name too long").optional(),
  lastName: z.string().max(100, "Last name too long").optional(),
});

/**
 * Update user profile (first name, last name)
 */
export async function updateProfile(formData: FormData) {
  return withActionAuth(formData.get("csrfToken") as string, {
    rateLimitKey: "profile:update",
    rateLimitMax: 20,
  }, async (user) => {
    const data = {
      firstName: (formData.get("firstName") as string) || undefined,
      lastName: (formData.get("lastName") as string) || undefined,
    };

    const result = profileSchema.safeParse(data);
    if (!result.success) {
      return { error: result.error.issues[0].message };
    }

    await db
      .update(users)
      .set({
        firstName: result.data.firstName || null,
        lastName: result.data.lastName || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await logAudit({
      userId: user.id,
      action: "update",
      entity: "user",
      entityId: user.id,
    });

    revalidatePath("/profile");
    return { success: true };
  });
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  prefs: {
    emailNewProposal: boolean;
    emailVoteOnMine: boolean;
    emailCommentReply: boolean;
    emailWeeklyDigest: boolean;
  },
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  return withActionAuth(csrfToken, {
    rateLimitKey: "profile:notifications",
    rateLimitMax: 20,
  }, async (user) => {
    await db
      .insert(notificationPreferences)
      .values({
        userId: user.id,
        emailNewProposal: prefs.emailNewProposal,
        emailVoteOnMine: prefs.emailVoteOnMine,
        emailCommentReply: prefs.emailCommentReply,
        emailWeeklyDigest: prefs.emailWeeklyDigest,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          emailNewProposal: prefs.emailNewProposal,
          emailVoteOnMine: prefs.emailVoteOnMine,
          emailCommentReply: prefs.emailCommentReply,
          emailWeeklyDigest: prefs.emailWeeklyDigest,
          updatedAt: new Date(),
        },
      });

    revalidatePath("/profile");
    return { success: true };
  });
}
