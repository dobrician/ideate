import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { search } from "@/lib/search";
import { semanticSearch } from "@/lib/semantic-search";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const VALID_MODES = ["fts", "semantic", "hybrid"] as const;
type SearchMode = (typeof VALID_MODES)[number];

/**
 * GET /api/search?q=<query>&limit=<n>&mode=<fts|semantic|hybrid>
 * Full-text and semantic search across projects and proposals.
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

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
    const modeParam = request.nextUrl.searchParams.get("mode") || "fts";
    const mode: SearchMode = VALID_MODES.includes(modeParam as SearchMode)
      ? (modeParam as SearchMode)
      : "fts";

    if (q.length < 2) {
      return NextResponse.json({ results: [], query: q, mode });
    }

    if (mode === "fts") {
      const results = search(q, Math.min(limit, 50));
      return NextResponse.json({ results, query: q, mode });
    }

    const results = await semanticSearch(q, {
      mode,
      limit: Math.min(limit, 50),
    });
    return NextResponse.json({ results, query: q, mode });
  } catch (error) {
    logger.error({ err: error }, "Search error");
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
