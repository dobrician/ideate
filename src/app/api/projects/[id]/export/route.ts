import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, proposals, votes, comments, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";
import { generateCsv, generateReportHtml } from "@/lib/export";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/export?format=pdf|csv
 * Export a project report with all proposals, votes, and comments
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const format = request.nextUrl.searchParams.get("format") || "pdf";

    if (format !== "pdf" && format !== "csv") {
      return NextResponse.json(
        { error: "Invalid format. Use 'pdf' or 'csv'." },
        { status: 400 }
      );
    }

    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (project.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectData = project[0];

    const proposalRows = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        description: proposals.description,
        summary: proposals.summary,
        userId: proposals.userId,
        createdAt: proposals.createdAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorEmail: users.email,
        upvotes: sql<number>`COALESCE(SUM(CASE WHEN ${votes.value} = 1 THEN 1 ELSE 0 END), 0)`,
        downvotes: sql<number>`COALESCE(SUM(CASE WHEN ${votes.value} = -1 THEN 1 ELSE 0 END), 0)`,
      })
      .from(proposals)
      .leftJoin(votes, eq(proposals.id, votes.proposalId))
      .leftJoin(users, eq(proposals.userId, users.id))
      .where(eq(proposals.projectId, id))
      .groupBy(proposals.id);

    const proposalIds = proposalRows.map((p) => p.id);
    let allComments: {
      proposalId: string;
      content: string;
      createdAt: Date | null;
      userName: string | null;
      userEmail: string | null;
    }[] = [];

    if (proposalIds.length > 0) {
      allComments = await db
        .select({
          proposalId: comments.proposalId,
          content: comments.content,
          createdAt: comments.createdAt,
          userName: users.firstName,
          userEmail: users.email,
        })
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .where(
          sql`${comments.proposalId} IN (${sql.join(
            proposalIds.map((pid) => sql`${pid}`),
            sql`, `
          )})`
        );
    }

    const commentsByProposal = new Map<string, typeof allComments>();
    for (const c of allComments) {
      const list = commentsByProposal.get(c.proposalId) || [];
      list.push(c);
      commentsByProposal.set(c.proposalId, list);
    }

    const exportData = {
      title: projectData.title,
      description: projectData.description,
      status: projectData.status,
      deadline: projectData.deadline,
      createdAt: projectData.createdAt,
      proposals: proposalRows.map((p) => ({
        title: p.title,
        description: p.description,
        summary: p.summary,
        authorName:
          [p.authorFirstName, p.authorLastName].filter(Boolean).join(" ") ||
          p.authorEmail ||
          "Anonymous",
        createdAt: p.createdAt,
        upvotes: Number(p.upvotes),
        downvotes: Number(p.downvotes),
        comments: (commentsByProposal.get(p.id) || []).map((c) => ({
          content: c.content,
          authorName: c.userName || c.userEmail || "Anonymous",
          createdAt: c.createdAt,
        })),
      })),
    };

    const safeTitle = projectData.title
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50);

    if (format === "csv") {
      const csv = generateCsv(exportData);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeTitle}-report.csv"`,
        },
      });
    }

    const html = generateReportHtml(exportData);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeTitle}-report.html"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to generate export" },
      { status: 500 }
    );
  }
}
