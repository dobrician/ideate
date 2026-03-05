import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Role } from "@/lib/rbac";
import {
  getRecentAlerts,
  getActiveAlerts,
  getAlertStats,
  resolveAlert,
  detectAndPersistRegressions,
} from "@/lib/ci-regression-alerts";
import { logger } from "@/lib/logger";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ci-alerts — Get CI regression alerts
 * Query params: ?active=true (active only) or ?limit=50 (recent)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const activeOnly = params.get("active") === "true";
    const limit = Math.min(Math.max(parseInt(params.get("limit") ?? "50", 10) || 50, 1), 200);

    const [alerts, stats] = await Promise.all([
      activeOnly ? getActiveAlerts() : getRecentAlerts(limit),
      getAlertStats(),
    ]);

    return NextResponse.json({ alerts, stats });
  } catch (error) {
    logger.error({ err: error }, "Failed to get CI alerts");
    return NextResponse.json({ error: "Failed to get alerts" }, { status: 500 });
  }
}

const postSchema = z.object({
  action: z.enum(["detect", "resolve"]),
  alertId: z.string().optional(),
});

/**
 * POST /api/admin/ci-alerts — Trigger detection or resolve an alert
 * Body: { action: "detect" } or { action: "resolve", alertId: "..." }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (parsed.data.action === "detect") {
      const alerts = await detectAndPersistRegressions();
      return NextResponse.json({ alerts, count: alerts.length });
    }

    if (parsed.data.action === "resolve") {
      if (!parsed.data.alertId) {
        return NextResponse.json({ error: "alertId required" }, { status: 400 });
      }
      const resolved = await resolveAlert(parsed.data.alertId);
      return NextResponse.json({ resolved });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    logger.error({ err: error }, "Failed to process CI alert action");
    return NextResponse.json({ error: "Failed to process action" }, { status: 500 });
  }
}
