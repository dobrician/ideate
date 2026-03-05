import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Role } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { exportCiBuildsCsv, type CiExportFilters } from "@/lib/analytics-export";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/export/ci-builds — Export CI build trends as CSV (admin only)
 * Query params: ?limit=50&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&branch=main
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`export-ci:${getClientIp(request)}`, 10, 60 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
    }

    const params = request.nextUrl.searchParams;
    const limitParam = params.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam ?? "50", 10) || 50, 1), 500);
    const startDate = params.get("startDate") ?? undefined;
    const endDate = params.get("endDate") ?? undefined;
    const branch = params.get("branch") ?? undefined;

    const filters: CiExportFilters = { limit, startDate, endDate, branch };
    const csv = await exportCiBuildsCsv(filters);
    const date = new Date().toISOString().split("T")[0];

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ci-builds-${date}.csv"`,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to export CI builds");
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 });
  }
}
