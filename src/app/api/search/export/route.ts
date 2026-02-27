import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { search } from "@/lib/search";
import { filteredSearch, type SearchFilters } from "@/lib/search";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/search/export?q=...&format=csv|json
 * Export search results as CSV or JSON.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = checkRateLimit(`search-export:ip:${getClientIp(request)}`, 10, 15 * 60_000);
  if (!ipCheck.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const params = request.nextUrl.searchParams;
  const q = params.get("q") || "";
  const format = params.get("format") || "json";

  if (q.length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  // Parse filters (same as main search route)
  const filters: SearchFilters = {};
  if (params.get("dateFrom")) filters.dateFrom = params.get("dateFrom")!;
  if (params.get("dateTo")) filters.dateTo = params.get("dateTo")!;
  if (params.get("authorId")) filters.authorId = params.get("authorId")!;
  if (params.get("projectId")) filters.projectId = params.get("projectId")!;
  if (params.get("tags")) {
    filters.tags = params.get("tags")!.split(",").map((t) => t.trim()).filter(Boolean);
  }
  if (params.get("entityTypes")) {
    const types = params.get("entityTypes")!.split(",").map((t) => t.trim());
    const valid = types.filter((t): t is "project" | "proposal" | "comment" =>
      ["project", "proposal", "comment"].includes(t)
    );
    if (valid.length > 0) filters.entityTypes = valid;
  }

  const hasFilters = Object.keys(filters).length > 0;
  const limit = 100; // Higher limit for export
  const results = hasFilters
    ? filteredSearch(q, filters, limit)
    : search(q, limit).map((r, i) => ({ ...r, score: 1 - i / 100 }));

  if (format === "csv") {
    const header = "Type,Title,Snippet,Score\n";
    const rows = results
      .map((r) => {
        const title = (r.title || "").replace(/"/g, '""');
        const snippet = ((r.snippet || "").replace(/<[^>]+>/g, "")).replace(/"/g, '""');
        return `"${r.type}","${title}","${snippet}",${("score" in r ? r.score : 0).toFixed(3)}`;
      })
      .join("\n");

    return new NextResponse(header + rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="search-results.csv"`,
      },
    });
  }

  return NextResponse.json({ results, query: q, total: results.length });
}
