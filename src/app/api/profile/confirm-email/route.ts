import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

interface EmailChangePayload {
  userId: string;
  newEmail: string;
  type: "email-change";
}

/**
 * GET /api/profile/confirm-email?token=...
 * Confirms an email change request by validating the JWT and updating the user's email.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  if (!token) {
    return NextResponse.redirect(`${appUrl}/profile?emailChange=invalid`);
  }

  try {
    const secret = process.env.JWT_SECRET || "";
    const payload = jwt.verify(token, secret, {
      issuer: "ideate",
      audience: "ideate",
    }) as EmailChangePayload;

    if (payload.type !== "email-change" || !payload.userId || !payload.newEmail) {
      return NextResponse.redirect(`${appUrl}/profile?emailChange=invalid`);
    }

    // Check email not already taken
    const existing = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, payload.newEmail))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.redirect(`${appUrl}/profile?emailChange=taken`);
    }

    await db.update(users)
      .set({ email: payload.newEmail, updatedAt: new Date() })
      .where(eq(users.id, payload.userId));

    await logAudit({
      userId: payload.userId,
      action: "change_email",
      entity: "user",
      entityId: payload.userId,
      details: `Email changed to ${payload.newEmail}`,
    });

    return NextResponse.redirect(`${appUrl}/profile?emailChange=success`);
  } catch (error) {
    logger.warn({ err: error }, "Email change token validation failed");
    return NextResponse.redirect(`${appUrl}/profile?emailChange=expired`);
  }
}
