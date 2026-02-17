"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { users, notificationPreferences } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { requireCsrfToken } from "@/lib/csrf";
import { validatePassword, verifyPassword, hashPassword } from "@/lib/password";

const profileSchema = z.object({
  firstName: z.string().max(100, "First name too long").optional(),
  lastName: z.string().max(100, "Last name too long").optional(),
});

/**
 * Update user profile (first name, last name)
 */
export async function updateProfile(formData: FormData) {
  try {
    await requireCsrfToken(formData.get("csrfToken") as string);
    const user = await requireAuth();

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
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to update profile" };
  }
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(1, "New password is required"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
});

/**
 * Change user password (requires current password verification)
 */
export async function changePassword(formData: FormData) {
  try {
    await requireCsrfToken(formData.get("csrfToken") as string);
    const user = await requireAuth();

    const data = {
      currentPassword: formData.get("currentPassword") as string,
      newPassword: formData.get("newPassword") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    const parsed = changePasswordSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const { currentPassword, newPassword, confirmPassword } = parsed.data;

    if (newPassword !== confirmPassword) {
      return { error: "passwordMismatch" };
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return { error: validation.error };
    }

    if (!user.passwordHash) {
      return { error: "noPasswordSet" };
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return { error: "incorrectPassword" };
    }

    const newHash = await hashPassword(newPassword);

    await db
      .update(users)
      .set({
        passwordHash: newHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await logAudit({
      userId: user.id,
      action: "change_password",
      entity: "user",
      entityId: user.id,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to change password" };
  }
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  prefs: {
    emailNewProposal: boolean;
    emailVoteOnMine: boolean;
    emailCommentReply: boolean;
  },
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();

    await db
      .insert(notificationPreferences)
      .values({
        userId: user.id,
        emailNewProposal: prefs.emailNewProposal,
        emailVoteOnMine: prefs.emailVoteOnMine,
        emailCommentReply: prefs.emailCommentReply,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          emailNewProposal: prefs.emailNewProposal,
          emailVoteOnMine: prefs.emailVoteOnMine,
          emailCommentReply: prefs.emailCommentReply,
          updatedAt: new Date(),
        },
      });

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to update notification preferences" };
  }
}
