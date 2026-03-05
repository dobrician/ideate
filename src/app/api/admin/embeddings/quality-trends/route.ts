import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Role } from "@/lib/rbac";
import { getQualityTrend, getQualityTrendSummary, takeQualitySnapshot } from "@/lib/embeddings/quality-trends";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/embeddings/quality-trends — Get quality trend data
 * Query params: ?days=90&limit=100
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const days = Math.min(Math.max(parseInt(params.get("days") ?? "90", 10) || 90, 1), 365);
    const limit = Math.min(Math.max(parseInt(params.get("limit") ?? "100", 10) || 100, 1), 500);

    const [trend, summary] = await Promise.all([
      getQualityTrend(days, limit),
      getQualityTrendSummary(),
    ]);

    return NextResponse.json({ trend, summary });
  } catch (error) {
    logger.error({ err: error }, "Failed to get quality trends");
    return NextResponse.json({ error: "Failed to get quality trends" }, { status: 500 });
  }
}

/**
 * POST /api/admin/embeddings/quality-trends — Take a quality snapshot manually
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await takeQualitySnapshot();
    if (!snapshot) {
      return NextResponse.json({ message: "No embeddings to score" }, { status: 200 });
    }

    return NextResponse.json({ snapshot });
  } catch (error) {
    logger.error({ err: error }, "Failed to take quality snapshot");
    return NextResponse.json({ error: "Failed to take snapshot" }, { status: 500 });
  }
}
