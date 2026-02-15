"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

const profileSchema = z.object({
  firstName: z.string().max(100, "First name too long").optional(),
  lastName: z.string().max(100, "Last name too long").optional(),
});

/**
 * Update user profile (first name, last name)
 */
export async function updateProfile(formData: FormData) {
  try {
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

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { error: "You must be logged in" };
    }
    return { error: "Failed to update profile" };
  }
}
