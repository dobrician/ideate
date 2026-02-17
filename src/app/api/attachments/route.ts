import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attachments, proposals } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { eq, count } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { resolve } from "path";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import { logger } from "@/lib/logger";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES_PER_PROPOSAL = 3;
const UPLOAD_DIR = resolve("data/uploads");

/**
 * POST /api/attachments
 * Upload a file attachment to a proposal
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role as Role, "proposal:create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const proposalId = formData.get("proposalId") as string | null;

    if (!file || !proposalId) {
      return NextResponse.json(
        { error: "File and proposalId are required" },
        { status: 400 }
      );
    }

    // Verify proposal exists
    const proposal = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (proposal.length === 0) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File must be under 5MB" },
        { status: 400 }
      );
    }

    // Check attachment count
    const [{ total }] = await db
      .select({ total: count() })
      .from(attachments)
      .where(eq(attachments.proposalId, proposalId));

    if (total >= MAX_FILES_PER_PROPOSAL) {
      return NextResponse.json(
        { error: "Maximum 3 files per proposal" },
        { status: 400 }
      );
    }

    // Save file to disk
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const ext = file.name.includes(".")
      ? "." + file.name.split(".").pop()
      : "";
    const storedName = `${randomUUID()}${ext}`;
    const storagePath = `data/uploads/${storedName}`;
    const fullPath = resolve(storagePath);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, buffer);

    // Insert DB record
    const id = randomUUID();
    await db.insert(attachments).values({
      id,
      proposalId,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      storagePath,
      userId: user.id,
    });

    await logAudit({
      userId: user.id,
      action: "upload",
      entity: "attachment",
      entityId: id,
      details: JSON.stringify({ proposalId, filename: file.name }),
    });

    return NextResponse.json({
      id,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    });
  } catch (error) {
    logger.error({ err: error }, "Attachment upload error");
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
