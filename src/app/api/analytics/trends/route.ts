import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getTrendSnapshot } from "@/lib/analytics/trends";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/trends?days=<n>
 * Get trending topics and proposals. Requires authentication.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ipCheck = checkRateLimit(
      `trends:ip:${getClientIp(request)}`,
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

    const parsedDays = parseInt(
      request.nextUrl.searchParams.get("days") || "7",
      10
    );
    const days = Number.isNaN(parsedDays) ? 7 : Math.min(Math.max(parsedDays, 1), 90);

    const snapshot = await getTrendSnapshot(days);
    return NextResponse.json(snapshot);
  } catch {
    return NextResponse.json(
      { error: "Failed to get trends" },
      { status: 500 }
    );
  }
}
