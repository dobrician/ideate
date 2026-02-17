import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  users,
  projects,
  proposals,
  votes,
  comments,
  notificationPreferences,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import archiver from "archiver";
import { PassThrough } from "stream";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/export — Per-user GDPR data export as ZIP
 * Contains: profile.json, projects.json, proposals.json, votes.json, comments.json, preferences.json
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [profile, myProjects, myProposals, myVotes, myComments, myPrefs] =
      await Promise.all([
        db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            role: users.role,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(eq(users.id, user.id)),
        db.select().from(projects).where(eq(projects.userId, user.id)),
        db.select().from(proposals).where(eq(proposals.userId, user.id)),
        db.select().from(votes).where(eq(votes.userId, user.id)),
        db.select().from(comments).where(eq(comments.userId, user.id)),
        db
          .select()
          .from(notificationPreferences)
          .where(eq(notificationPreferences.userId, user.id)),
      ]);

    const passthrough = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(passthrough);

    archive.append(JSON.stringify(profile[0] || {}, null, 2), {
      name: "profile.json",
    });
    archive.append(JSON.stringify(myProjects, null, 2), {
      name: "projects.json",
    });
    archive.append(JSON.stringify(myProposals, null, 2), {
      name: "proposals.json",
    });
    archive.append(JSON.stringify(myVotes, null, 2), { name: "votes.json" });
    archive.append(JSON.stringify(myComments, null, 2), {
      name: "comments.json",
    });
    archive.append(JSON.stringify(myPrefs[0] || {}, null, 2), {
      name: "preferences.json",
    });
    archive.append(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          userId: user.id,
          counts: {
            projects: myProjects.length,
            proposals: myProposals.length,
            votes: myVotes.length,
            comments: myComments.length,
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
        "Content-Disposition": `attachment; filename="my-data-export-${date}.zip"`,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to generate user data export");
    return NextResponse.json(
      { error: "Failed to generate export" },
      { status: 500 }
    );
  }
}
