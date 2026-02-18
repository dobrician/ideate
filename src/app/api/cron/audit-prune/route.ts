import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { lt } from "drizzle-orm";

const CRON_SECRET = process.env.CRON_SECRET;
const DEFAULT_TTL_DAYS = 90;

/**
 * GET /api/cron/audit-prune
 * Delete audit log entries older than AUDIT_RETENTION_DAYS (default 90).
 * Auth: Bearer token matching CRON_SECRET env var.
 */
export async function GET(request: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ttlDays = Number(process.env.AUDIT_RETENTION_DAYS) || DEFAULT_TTL_DAYS;
  const cutoff = new Date(Date.now() - ttlDays * 86_400_000);

  const result = await db
    .delete(auditLogs)
    .where(lt(auditLogs.createdAt, cutoff));

  const deleted = result.changes ?? 0;
  return NextResponse.json({ deleted, ttlDays });
}
