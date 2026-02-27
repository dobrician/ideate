import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSuggestions } from "@/lib/search";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/search/suggestions?q=<prefix>
 * Returns autocomplete suggestions for the search bar.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheck = checkRateLimit(`suggest:ip:${getClientIp(request)}`, 120, 15 * 60_000);
  if (!ipCheck.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const q = request.nextUrl.searchParams.get("q") || "";
  if (q.length < 1) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await getSuggestions(q, 8);
  return NextResponse.json({ suggestions });
}
