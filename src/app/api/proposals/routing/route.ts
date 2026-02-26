import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { getRoutingSuggestions, getRoutingForProposal } from "@/lib/ai/routing";
import { z } from "zod";

const routingSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  currentProjectId: z.string().max(100).optional(),
});

/**
 * POST /api/proposals/routing — get routing suggestions for a new proposal.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const ip = getClientIp(request);
    const rl = checkRateLimit(`routing:${ip}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = routingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }

    const { title, description, currentProjectId } = parsed.data;
    const suggestions = await getRoutingSuggestions(title, description ?? null, currentProjectId);

    return NextResponse.json({ suggestions });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/proposals/routing?proposalId=xxx — get routing for an existing proposal.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const ip = getClientIp(request);
    const rl = checkRateLimit(`routing:${ip}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const proposalId = request.nextUrl.searchParams.get("proposalId");
    if (!proposalId) {
      return NextResponse.json({ error: "proposalId is required" }, { status: 400 });
    }

    const suggestions = await getRoutingForProposal(proposalId);
    return NextResponse.json({ suggestions });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
