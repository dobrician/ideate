import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Role } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { exportSearchAnalyticsCsv, type SearchExportFilters } from "@/lib/analytics-export";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/export/search-analytics — Export search analytics as CSV (admin only)
 * Query params: ?days=30&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&mode=fts|semantic|hybrid
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`export-search:${getClientIp(request)}`, 10, 60 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
    }

    const params = request.nextUrl.searchParams;
    const daysParam = params.get("days");
    const startDate = params.get("startDate") ?? undefined;
    const endDate = params.get("endDate") ?? undefined;
    const mode = params.get("mode") ?? undefined;
    const daysBack = Math.min(Math.max(parseInt(daysParam ?? "30", 10) || 30, 1), 365);

    const filters: SearchExportFilters = { daysBack, startDate, endDate, mode };
    const csv = await exportSearchAnalyticsCsv(filters);
    const date = new Date().toISOString().split("T")[0];

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="search-analytics-${date}.csv"`,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to export search analytics");
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 });
  }
}
