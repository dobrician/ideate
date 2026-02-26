import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { generateRoadmap } from "@/lib/ai/roadmap";

/**
 * GET /api/projects/roadmap?projectId=xxx — generate a roadmap for a project.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const ip = getClientIp(request);
    const rl = checkRateLimit(`roadmap:${ip}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const roadmap = await generateRoadmap(projectId);
    if (!roadmap) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ roadmap });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
