import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuth, requireCsrfToken } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { db } from "@/db";
import { projects, proposals, votes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logAudit } from "@/lib/audit";

interface SuggestedProposal {
  title: string;
  details: string;
  summary: string;
  vote: 1 | -1;
}

interface SubmitRequest {
  projectId: string;
  proposals: SuggestedProposal[];
  csrfToken: string;
}

/**
 * POST /api/proposals/submit-suggested
 * Create real proposals from AI-suggested ones, with the user's vote.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = user.role as Role;
  if (!hasPermission(role, "proposal:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as SubmitRequest;

    await requireCsrfToken(body.csrfToken);

    if (!body.projectId || !Array.isArray(body.proposals) || body.proposals.length === 0) {
      return NextResponse.json(
        { error: "projectId and proposals array are required" },
        { status: 400 }
      );
    }

    const project = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, body.projectId))
      .limit(1);

    if (project.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    let created = 0;
    for (const p of body.proposals) {
      if (!p.title || !p.details) continue;

      const proposalId = randomUUID();
      await db.insert(proposals).values({
        id: proposalId,
        projectId: body.projectId,
        title: p.title.slice(0, 200),
        description: p.details,
        summary: p.summary?.slice(0, 260) || null,
        userId: user.id,
      });

      const voteValue = p.vote === -1 ? -1 : 1;
      await db.insert(votes).values({
        proposalId,
        userId: user.id,
        value: voteValue,
      });

      await logAudit({
        userId: user.id,
        action: "create",
        entity: "proposal",
        entityId: proposalId,
        details: JSON.stringify({
          title: p.title,
          projectId: body.projectId,
          source: "ai-suggestion",
        }),
      });

      created++;
    }

    revalidatePath(`/projects/${body.projectId}`);
    return NextResponse.json({ created });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid CSRF token") {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to create proposals" },
      { status: 500 }
    );
  }
}
