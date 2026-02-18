import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { desc, sql, gte, lte } from "drizzle-orm";
import { logger } from "@/lib/logger";

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * GET /api/admin/audit-export?format=csv|json&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
 * Export audit log entries (admin only).
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rl = checkRateLimit(`audit-export:${getClientIp(request)}`, 5, 60 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    if (format !== "csv" && format !== "json") {
      return NextResponse.json(
        { error: "Invalid format. Use 'csv' or 'json'." },
        { status: 400 }
      );
    }

    const conditions = [];
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      if (!isNaN(fromDate.getTime())) {
        conditions.push(gte(auditLogs.createdAt, fromDate));
      }
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (!isNaN(toDate.getTime())) {
        conditions.push(lte(auditLogs.createdAt, toDate));
      }
    }

    let query = db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        userEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, sql`${auditLogs.userId} = ${users.id}`)
      .orderBy(desc(auditLogs.createdAt))
      .$dynamic();

    for (const condition of conditions) {
      query = query.where(condition);
    }

    const entries = await query;

    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      const jsonData = entries.map((e) => ({
        id: e.id,
        action: e.action,
        entity: e.entity,
        entityId: e.entityId,
        details: e.details,
        ipAddress: e.ipAddress,
        userEmail: e.userEmail,
        createdAt: e.createdAt?.toISOString() ?? null,
      }));

      return new NextResponse(JSON.stringify(jsonData, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit-log-${timestamp}.json"`,
        },
      });
    }

    // CSV format
    const header = ["ID", "Action", "Entity", "Entity ID", "Details", "IP Address", "User Email", "Created At"];
    const rows = entries.map((e) => [
      e.id,
      e.action,
      e.entity,
      e.entityId || "",
      e.details || "",
      e.ipAddress || "",
      e.userEmail || "",
      e.createdAt?.toISOString() ?? "",
    ]);

    const csv = [
      header.map(escapeCsvField).join(","),
      ...rows.map((row) => row.map(escapeCsvField).join(",")),
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-log-${timestamp}.csv"`,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Audit export error");
    return NextResponse.json(
      { error: "Failed to generate export" },
      { status: 500 }
    );
  }
}
