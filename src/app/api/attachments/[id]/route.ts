import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, canManageResource } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { readFile, unlink } from "fs/promises";
import { resolve } from "path";
import { existsSync } from "fs";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/attachments/[id]
 * Download an attachment file
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const rows = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, id))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    const attachment = rows[0];
    const fullPath = resolve(attachment.storagePath);

    if (!existsSync(fullPath)) {
      return NextResponse.json(
        { error: "File not found on disk" },
        { status: 404 }
      );
    }

    const buffer = await readFile(fullPath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.filename)}"`,
        "Content-Length": String(attachment.size),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Attachment download error");
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/attachments/[id]
 * Delete an attachment (owner or admin only)
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const rows = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, id))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    const attachment = rows[0];

    if (
      !canManageResource(user.role as Role, attachment.userId, user.id)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete file from disk
    const fullPath = resolve(attachment.storagePath);
    if (existsSync(fullPath)) {
      await unlink(fullPath);
    }

    // Delete DB record
    await db.delete(attachments).where(eq(attachments.id, id));

    await logAudit({
      userId: user.id,
      action: "delete",
      entity: "attachment",
      entityId: id,
      details: JSON.stringify({
        proposalId: attachment.proposalId,
        filename: attachment.filename,
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Attachment delete error");
    return NextResponse.json(
      { error: "Failed to delete attachment" },
      { status: 500 }
    );
  }
}
