"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { db } from "@/db";
import { users, notificationPreferences } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { requireCsrfToken } from "@/lib/csrf";
import { validatePassword, verifyPassword, hashPassword } from "@/lib/password";
import { sendEmailChangeEmail } from "@/lib/mail";
import { checkRateLimit } from "@/lib/rate-limit";
import { getActionClientIp } from "@/lib/request-utils";

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

    const ip = await getActionClientIp();
    const rl = checkRateLimit(`profile:update:${ip}`, 20, 15 * 60_000);
    if (!rl.allowed) return { error: "Too many requests — please try again later" };

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

    const ip = await getActionClientIp();
    const rl = checkRateLimit(`profile:changePassword:${ip}`, 5, 15 * 60_000);
    if (!rl.allowed) return { error: "Too many requests — please try again later" };

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
    emailWeeklyDigest: boolean;
  },
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();

    const ip = await getActionClientIp();
    const rl = checkRateLimit(`profile:notifications:${ip}`, 20, 15 * 60_000);
    if (!rl.allowed) return { error: "Too many requests — please try again later" };

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
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to update notification preferences" };
  }
}

const emailChangeSchema = z.object({
  newEmail: z.string().email("Invalid email address").max(255),
});

/**
 * Request email change — sends verification link to the new email address
 */
export async function requestEmailChange(formData: FormData) {
  try {
    await requireCsrfToken(formData.get("csrfToken") as string);
    const user = await requireAuth();

    const ip = await getActionClientIp();
    const rl = checkRateLimit(`profile:emailChange:${ip}`, 3, 15 * 60_000);
    if (!rl.allowed) return { error: "Too many requests — please try again later" };

    const parsed = emailChangeSchema.safeParse({
      newEmail: (formData.get("newEmail") as string)?.toLowerCase().trim(),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const { newEmail } = parsed.data;

    if (newEmail === user.email) {
      return { error: "sameEmail" };
    }

    // Check if email is already in use
    const existing = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, newEmail))
      .limit(1);

    if (existing.length > 0) {
      return { error: "emailInUse" };
    }

    const secret = process.env.JWT_SECRET || "";
    const appUrl = process.env.APP_URL || "http://localhost:3000";

    const token = jwt.sign(
      { userId: user.id, newEmail, type: "email-change" },
      secret,
      { expiresIn: "1h", issuer: "ideate", audience: "ideate" }
    );

    const verifyLink = `${appUrl}/api/profile/confirm-email?token=${token}`;
    await sendEmailChangeEmail(newEmail, verifyLink);

    await logAudit({
      userId: user.id,
      action: "request_email_change",
      entity: "user",
      entityId: user.id,
      details: `Requested change to ${newEmail}`,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to request email change" };
  }
}
