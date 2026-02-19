import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Role } from "@/lib/rbac";
import { requireOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { logger } from "@/lib/logger";
import { logAudit } from "@/lib/audit";
import { seedDemoData } from "@/lib/factories/seed";

/**
 * POST /api/admin/seed-demo
 * Seeds the database with realistic demo data. Admin-only.
 * Body: { clean?: boolean } — if true (default), clears existing data first.
 */
export async function POST(request: NextRequest) {
  const originError = requireOrigin(request);
  if (originError) return originError;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user.role as Role, "project:manage_all")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rl = checkRateLimit(`seed-demo:${getClientIp(request)}`, 3, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const clean = body.clean !== false; // default true

    const result = await seedDemoData(clean);

    logAudit({
      userId: user.id,
      action: "create",
      entity: "project",
      details: `Seeded demo data: ${result.users} users, ${result.projects} projects, ${result.proposals} proposals`,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, "Failed to seed demo data");
    return NextResponse.json(
      { error: "Failed to seed demo data" },
      { status: 500 },
    );
  }
}
