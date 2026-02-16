import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { hasPermission, canManageResource } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateProjectSummary } from "@/lib/project-summary";

/**
 * POST /api/projects/[id]/summary
 * Regenerate AI summary for a project (owner or admin only).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const project = await db
      .select({ userId: projects.userId })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (project.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const role = user.role as Role;
    if (
      !hasPermission(role, "project:manage_all") &&
      !canManageResource(role, project[0].userId, user.id)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const summary = await generateProjectSummary(id, { force: true });

    if (!summary) {
      return NextResponse.json(
        { error: "Could not generate summary" },
        { status: 500 }
      );
    }

    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
