import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRecommendations } from "@/lib/recommendations";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/proposals/recommendations?limit=<n>
 * Get personalized proposal recommendations for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ipCheck = checkRateLimit(
      `recommendations:ip:${getClientIp(request)}`,
      30,
      15 * 60_000
    );
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(ipCheck.retryAfterMs / 1000)),
          },
        }
      );
    }

    const parsedLimit = parseInt(
      request.nextUrl.searchParams.get("limit") || "10",
      10
    );
    const limit = Number.isNaN(parsedLimit) ? 10 : Math.min(parsedLimit, 50);

    const recommendations = await getRecommendations(user.id, limit);
    return NextResponse.json({ recommendations });
  } catch {
    return NextResponse.json(
      { error: "Failed to get recommendations" },
      { status: 500 }
    );
  }
}
