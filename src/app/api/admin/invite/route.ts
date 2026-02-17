import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { requireOrigin } from "@/lib/csrf";
import { sendInvitationEmail } from "@/lib/mail";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { db } from "@/db";
import { invitations, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const INVITATION_EXPIRY_DAYS = 7;

const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

/**
 * POST /api/admin/invite
 * Admin sends an invitation to a user by email.
 */
export async function POST(request: NextRequest) {
  try {
    const originError = requireOrigin(request);
    if (originError) return originError;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const result = inviteSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = result.data;

    // Check if user already exists
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    // Check for pending invitation
    const existingInvite = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(and(eq(invitations.email, email), eq(invitations.status, "pending")))
      .limit(1);

    if (existingInvite.length > 0) {
      return NextResponse.json(
        { error: "An invitation is already pending for this email" },
        { status: 409 }
      );
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await db.insert(invitations).values({
      email,
      token,
      invitedBy: user.id,
      expiresAt,
    });

    const inviteLink = `${APP_URL}/auth/register?invite=${encodeURIComponent(token)}`;

    try {
      await sendInvitationEmail(email, inviteLink, user.email);
    } catch (error) {
      logger.error({ err: error }, "Failed to send invitation email");
      // Still return success — invitation is recorded even if email fails
    }

    await logAudit({
      userId: user.id,
      action: "create",
      entity: "user",
      details: `invited ${email}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Invite error");
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/invite
 * List pending invitations (admin only).
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pending = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
        inviterEmail: users.email,
      })
      .from(invitations)
      .leftJoin(users, eq(invitations.invitedBy, users.id))
      .orderBy(invitations.createdAt);

    return NextResponse.json({ invitations: pending });
  } catch (error) {
    logger.error({ err: error }, "List invitations error");
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
