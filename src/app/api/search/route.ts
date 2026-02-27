import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { search } from "@/lib/search";
import { semanticSearch } from "@/lib/semantic-search";
import { filteredSearch, trackSearch, type SearchFilters } from "@/lib/search";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { logger } from "@/lib/logger";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const VALID_MODES = ["fts", "semantic", "hybrid"] as const;
type SearchMode = (typeof VALID_MODES)[number];

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

    const params = request.nextUrl.searchParams;
    const q = params.get("q") || "";
    const parsedLimit = parseInt(params.get("limit") || "20", 10);
    const limit = Number.isNaN(parsedLimit) ? 20 : Math.min(parsedLimit, 50);
    const modeParam = params.get("mode") || "fts";
    const mode: SearchMode = VALID_MODES.includes(modeParam as SearchMode)
      ? (modeParam as SearchMode)
      : "fts";

    if (q.length < 2) {
      return NextResponse.json({ results: [], query: q, mode });
    }

    // Parse filters
    const filters: SearchFilters = {};
    if (params.get("dateFrom")) filters.dateFrom = params.get("dateFrom")!;
    if (params.get("dateTo")) filters.dateTo = params.get("dateTo")!;
    if (params.get("authorId")) filters.authorId = params.get("authorId")!;
    if (params.get("projectId")) filters.projectId = params.get("projectId")!;
    if (params.get("projectStatus")) {
      const s = params.get("projectStatus")!;
      if (["active", "archived", "draft"].includes(s)) {
        filters.projectStatus = s as "active" | "archived" | "draft";
      }
    }
    if (params.get("tags")) {
      filters.tags = params.get("tags")!.split(",").map((t) => t.trim()).filter(Boolean);
    }
    if (params.get("minVotes")) {
      const mv = parseInt(params.get("minVotes")!, 10);
      if (!Number.isNaN(mv) && mv > 0) filters.minVotes = mv;
    }
    if (params.get("entityTypes")) {
      const types = params.get("entityTypes")!.split(",").map((t) => t.trim());
      const valid = types.filter((t): t is "project" | "proposal" | "comment" =>
        ["project", "proposal", "comment"].includes(t)
      );
      if (valid.length > 0) filters.entityTypes = valid;
    }

    const hasFilters = Object.keys(filters).length > 0;
    const startTime = Date.now();
    let results;
    const analyticsId = randomUUID();

    if (hasFilters && mode === "fts") {
      // Use filtered search
      results = filteredSearch(q, filters, limit);
    } else if (mode === "fts") {
      const ftsResults = search(q, limit);
      results = ftsResults.map((r, i) => ({
        ...r,
        score: 1 - i / Math.max(ftsResults.length, 1),
      }));
    } else {
      results = await semanticSearch(q, { mode, limit });
    }

    const responseTimeMs = Date.now() - startTime;

    // Track analytics asynchronously (don't block response)
    trackSearch({
      userId: user.id,
      query: q,
      mode,
      filters: hasFilters ? (filters as Record<string, unknown>) : undefined,
      resultCount: results.length,
      responseTimeMs,
    }).catch(() => {});

    return NextResponse.json({
      results,
      query: q,
      mode,
      analyticsId,
      total: results.length,
      responseTimeMs,
    });
  } catch (error) {
    logger.error({ err: error }, "Search error");
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
