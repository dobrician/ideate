import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { search } from "@/lib/search";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=<query>&limit=<n>
 * Full-text search across projects and proposals. Requires authentication.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ipCheck = checkRateLimit(`search:ip:${getClientIp(request)}`, 60, 15 * 60_000);
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(ipCheck.retryAfterMs / 1000)) } }
      );
    }

    const q = request.nextUrl.searchParams.get("q") || "";
    const parsedLimit = parseInt(
      request.nextUrl.searchParams.get("limit") || "20",
      10
    );
    const limit = Number.isNaN(parsedLimit) ? 20 : parsedLimit;

    if (q.length < 2) {
      return NextResponse.json({ results: [], query: q });
    }

    const results = search(q, Math.min(limit, 50));
    return NextResponse.json({ results, query: q });
  } catch (error) {
    logger.error({ err: error }, "Search error");
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
