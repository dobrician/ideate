import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { detectConflicts, checkProposalConflicts } from "@/lib/ai/conflicts";
import { z } from "zod";

/**
 * GET /api/proposals/conflicts?projectId=xxx — detect conflicts in a project.
 * GET /api/proposals/conflicts?proposalId=xxx — check conflicts for one proposal.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const ip = getClientIp(request);
    const rl = checkRateLimit(`conflicts:${ip}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const projectId = request.nextUrl.searchParams.get("projectId");
    const proposalId = request.nextUrl.searchParams.get("proposalId");

    if (!projectId && !proposalId) {
      return NextResponse.json(
        { error: "projectId or proposalId is required" },
        { status: 400 }
      );
    }

    if (proposalId) {
      const conflicts = await checkProposalConflicts(proposalId);
      return NextResponse.json({ conflicts });
    }

    const conflicts = await detectConflicts(projectId!);
    return NextResponse.json({ conflicts });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
