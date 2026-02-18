import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, proposals, votes, comments, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Role } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { logger } from "@/lib/logger";
import archiver from "archiver";
import { PassThrough } from "stream";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/export — Full platform data export as ZIP (admin only)
 * Contains: projects.json, proposals.json, votes.json, comments.json, users.json
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "project:manage_all")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`admin-export:${getClientIp(request)}`, 5, 60 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
    }

    const [allProjects, allProposals, allVotes, allComments, allUsers] =
      await Promise.all([
        db.select().from(projects),
        db.select().from(proposals),
        db.select().from(votes),
        db.select().from(comments),
        db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            role: users.role,
            createdAt: users.createdAt,
          })
          .from(users),
      ]);

    const passthrough = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(passthrough);

    archive.append(JSON.stringify(allProjects, null, 2), {
      name: "projects.json",
    });
    archive.append(JSON.stringify(allProposals, null, 2), {
      name: "proposals.json",
    });
    archive.append(JSON.stringify(allVotes, null, 2), { name: "votes.json" });
    archive.append(JSON.stringify(allComments, null, 2), {
      name: "comments.json",
    });
    archive.append(JSON.stringify(allUsers, null, 2), { name: "users.json" });
    archive.append(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          exportedBy: user.email,
          counts: {
            projects: allProjects.length,
            proposals: allProposals.length,
            votes: allVotes.length,
            comments: allComments.length,
            users: allUsers.length,
          },
        },
        null,
        2
      ),
      { name: "metadata.json" }
    );

    await archive.finalize();

    const chunks: Uint8Array[] = [];
    for await (const chunk of passthrough) {
      chunks.push(chunk as Uint8Array);
    }
    const buffer = Buffer.concat(chunks);

    const date = new Date().toISOString().split("T")[0];
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="ideate-platform-export-${date}.zip"`,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to generate platform export");
    return NextResponse.json(
      { error: "Failed to generate export" },
      { status: 500 }
    );
  }
}
