import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Role } from "@/lib/rbac";
import { compareBranches, getAvailableBranches } from "@/lib/ci-build-comparison";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ci-builds/compare — Compare builds between two branches
 * Query params: ?branchA=main&branchB=feature&limit=20
 * Without params: returns list of available branches
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const branchA = request.nextUrl.searchParams.get("branchA");
    const branchB = request.nextUrl.searchParams.get("branchB");

    // If no branches specified, return available branches
    if (!branchA || !branchB) {
      const branches = await getAvailableBranches();
      return NextResponse.json({ branches });
    }

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam ?? "20", 10) || 20, 1), 100);

    const comparison = await compareBranches(branchA, branchB, limit);
    return NextResponse.json(comparison);
  } catch (error) {
    logger.error({ err: error }, "Failed to compare CI builds");
    return NextResponse.json({ error: "Failed to compare builds" }, { status: 500 });
  }
}
