import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { predictDeadline, assessDeadlineHealth } from "@/lib/ai/deadlines";
import { z } from "zod";

const predictSchema = z.object({
  title: z.string().min(1).max(500),
  proposalCountEstimate: z.number().int().min(0).max(1000).optional(),
});

/**
 * POST /api/projects/deadlines — predict a deadline for a new project.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const ip = getClientIp(request);
    const rl = checkRateLimit(`deadlines:${ip}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = predictSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }

    const prediction = await predictDeadline(parsed.data.title, parsed.data.proposalCountEstimate);
    return NextResponse.json({ prediction });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/projects/deadlines?projectId=xxx — get deadline health for a project.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const ip = getClientIp(request);
    const rl = checkRateLimit(`deadlines:${ip}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const health = await assessDeadlineHealth(projectId);
    if (!health) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ health });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
