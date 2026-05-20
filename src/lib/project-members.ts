import { db } from "@/db";
import { projectMembers } from "@/db/schema";
import { hasPermission } from "@/lib/rbac";
import type { Role, Permission } from "@/lib/rbac";
import { and, eq, sql } from "drizzle-orm";

export async function isProjectMember(
  projectId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Add a (project, user) row. Idempotent — ON CONFLICT DO NOTHING.
 * Called when a logged-in user visits /p/<token> for a project they haven't joined yet.
 */
export async function joinProjectAsMember(
  projectId: string,
  userId: string,
  joinedVia: "share_link" | "manual" = "share_link",
): Promise<void> {
  await db
    .insert(projectMembers)
    .values({ projectId, userId, joinedVia })
    .onConflictDoNothing();
}

const PROJECT_PERMISSIONS = new Set<Permission>([
  "proposal:create",
  "vote:cast",
  "comment:create",
]);

/**
 * Authorisation check that combines the user's global role with their
 * per-project membership: a viewer who has joined the project via a
 * share link can still cast votes / create proposals / comment on
 * THAT project. Permissions outside PROJECT_PERMISSIONS fall back to
 * the global role only.
 */
export async function canActOnProject(
  role: Role,
  userId: string,
  projectId: string,
  permission: Permission,
): Promise<boolean> {
  if (hasPermission(role, permission)) return true;
  if (!PROJECT_PERMISSIONS.has(permission)) return false;
  return isProjectMember(projectId, userId);
}

export { sql };
