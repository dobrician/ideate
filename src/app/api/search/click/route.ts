import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { trackSearchClick } from "@/lib/search";

export const dynamic = "force-dynamic";

/**
 * POST /api/search/click
 * Track click on search result for analytics.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { analyticsId, resultId, resultType } = body;

    if (!analyticsId || !resultId || !resultType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["project", "proposal", "comment"].includes(resultType)) {
      return NextResponse.json({ error: "Invalid result type" }, { status: 400 });
    }

    await trackSearchClick(analyticsId, resultId, resultType);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to track click" }, { status: 500 });
  }
}
