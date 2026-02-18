"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { teams, teamMembers, users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { eq, and } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { requireCsrfToken } from "@/lib/csrf";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createTeam(
  name: string,
  description: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();
    if (!hasPermission(user.role as Role, "user:manage")) {
      return { error: "Only admins can create teams" };
    }
    if (!name.trim()) return { error: "Team name is required" };

    const slug = slugify(name);
    if (!slug) return { error: "Invalid team name" };

    const existing = await db.select().from(teams).where(eq(teams.slug, slug)).limit(1);
    if (existing.length > 0) return { error: "A team with this slug already exists" };

    const [team] = await db.insert(teams).values({
      name: name.trim(),
      slug,
      description: description.trim() || null,
      ownerId: user.id,
    }).returning();

    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: user.id,
      role: "owner",
    });

    await logAudit({
      userId: user.id,
      action: "create",
      entity: "team",
      entityId: team.id,
      details: JSON.stringify({ name: team.name, slug }),
    });

    revalidatePath("/admin");
    return { success: true };
  } catch {
    return { error: "Failed to create team" };
  }
}

export async function deleteTeam(
  teamId: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();
    if (!hasPermission(user.role as Role, "user:manage")) {
      return { error: "Only admins can delete teams" };
    }

    await db.delete(teams).where(eq(teams.id, teamId));
    await logAudit({
      userId: user.id,
      action: "delete",
      entity: "team",
      entityId: teamId,
    });

    revalidatePath("/admin");
    return { success: true };
  } catch {
    return { error: "Failed to delete team" };
  }
}

export async function addTeamMember(
  teamId: string,
  email: string,
  role: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();
    if (!hasPermission(user.role as Role, "user:manage")) {
      return { error: "Only admins can manage team members" };
    }
    if (!email.trim()) return { error: "Email is required" };

    const target = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    if (target.length === 0) return { error: "User not found" };

    const existing = await db.select().from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, target[0].id)))
      .limit(1);
    if (existing.length > 0) return { error: "User is already a member" };

    const validRoles = ["owner", "admin", "member", "viewer"];
    const memberRole = validRoles.includes(role) ? role : "member";

    await db.insert(teamMembers).values({
      teamId,
      userId: target[0].id,
      role: memberRole as "owner" | "admin" | "member" | "viewer",
    });

    await logAudit({
      userId: user.id,
      action: "add_member",
      entity: "team",
      entityId: teamId,
      details: JSON.stringify({ memberId: target[0].id, email: target[0].email, role: memberRole }),
    });

    revalidatePath("/admin");
    return { success: true };
  } catch {
    return { error: "Failed to add member" };
  }
}

export async function removeTeamMember(
  teamId: string,
  memberId: string,
  csrfToken: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireCsrfToken(csrfToken);
    const user = await requireAuth();
    if (!hasPermission(user.role as Role, "user:manage")) {
      return { error: "Only admins can manage team members" };
    }

    await db.delete(teamMembers).where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, memberId))
    );

    await logAudit({
      userId: user.id,
      action: "remove_member",
      entity: "team",
      entityId: teamId,
      details: JSON.stringify({ memberId }),
    });

    revalidatePath("/admin");
    return { success: true };
  } catch {
    return { error: "Failed to remove member" };
  }
}
