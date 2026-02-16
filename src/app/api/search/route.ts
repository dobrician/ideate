import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/search";

export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=<query>&limit=<n>
 * Full-text search across projects and proposals
 */
export function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  const parsedLimit = parseInt(
    request.nextUrl.searchParams.get("limit") || "20",
    10
  );
  const limit = Number.isNaN(parsedLimit) ? 20 : parsedLimit;

  if (q.length < 2) {
    return NextResponse.json({ results: [], query: q });
  }

  try {
    const results = search(q, Math.min(limit, 50));
    return NextResponse.json({ results, query: q });
  } catch {
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
