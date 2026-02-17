import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projectTemplates } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Role } from "@/lib/rbac";
import { requireOrigin } from "@/lib/csrf";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/admin/templates/[id] — Delete a project template (admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const originError = requireOrigin(request);
    if (originError) return originError;

    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "project:manage_all")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await db.delete(projectTemplates).where(eq(projectTemplates.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete template");
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
