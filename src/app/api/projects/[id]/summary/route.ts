import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { hasPermission, canManageResource } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateProjectSummary } from "@/lib/project-summary";
import { isAiConfigured, isAiRateLimited } from "@/lib/llm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";

/**
 * POST /api/projects/[id]/summary
 * Regenerate AI summary for a project (owner or admin only).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();

    const rl = checkRateLimit(`summary:${getClientIp(request)}`, 10, 15 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
    }
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

    if (!isAiConfigured()) {
      return NextResponse.json(
        { error: "AI not configured", code: "NO_KEYS" },
        { status: 503 }
      );
    }

    if (isAiRateLimited()) {
      return NextResponse.json(
        { error: "Rate limited — try again later", code: "RATE_LIMITED" },
        { status: 429 }
      );
    }

    const summary = await generateProjectSummary(id, { force: true });

    if (!summary) {
      return NextResponse.json(
        { error: "AI temporarily unavailable", code: "AI_UNAVAILABLE" },
        { status: 503 }
      );
    }

    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
