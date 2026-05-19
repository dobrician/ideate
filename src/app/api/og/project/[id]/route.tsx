import { ImageResponse } from "next/og";
import { db } from "@/db";
import { projects, proposals, votes } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = { width: 1200, height: 630 };
const TOP_PROPOSALS = 5;
const ogLog = logger.child({ module: "og-image" });

/**
 * GET /api/og/project/[id]
 * Dynamic Open Graph image for a project, showing top proposals' vote standings.
 * Reflects DB state at request time — short Cache-Control TTL so social-media
 * scrapers and in-app meta tags get fresh data soon after votes change.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const projectRows = await db
      .select({
        title: projects.title,
        summary: projects.summary,
        status: projects.status,
      })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (projectRows.length === 0) {
      return new Response("Not found", { status: 404 });
    }
    const project = projectRows[0];

    // Top N proposals by net votes
    const upExpr = sql<number>`COALESCE(SUM(CASE WHEN ${votes.value} = 1 THEN 1 ELSE 0 END), 0)`;
    const downExpr = sql<number>`COALESCE(SUM(CASE WHEN ${votes.value} = -1 THEN 1 ELSE 0 END), 0)`;
    const netExpr = sql<number>`(${upExpr} - ${downExpr})`;

    const topProposals = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        upvotes: upExpr,
        downvotes: downExpr,
      })
      .from(proposals)
      .leftJoin(votes, eq(proposals.id, votes.proposalId))
      .where(eq(proposals.projectId, id))
      .groupBy(proposals.id)
      .orderBy(desc(netExpr))
      .limit(TOP_PROPOSALS);

    const totalProposalsRow = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(proposals)
      .where(eq(proposals.projectId, id));
    const totalProposals = Number(totalProposalsRow[0]?.c ?? 0);

    const totalVotesRow = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(votes)
      .leftJoin(proposals, eq(votes.proposalId, proposals.id))
      .where(eq(proposals.projectId, id));
    const totalVotes = Number(totalVotesRow[0]?.c ?? 0);

    const maxTotal = Math.max(
      1,
      ...topProposals.map((p) => Number(p.upvotes) + Number(p.downvotes)),
    );

    const truncatedTitle =
      project.title.length > 60 ? project.title.slice(0, 60) + "…" : project.title;

    const statusColor =
      project.status === "archived"
        ? "#94a3b8"
        : project.status === "draft"
          ? "#fbbf24"
          : "#22c55e";

    const img = new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            color: "#f8fafc",
            padding: "56px 64px",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                background: statusColor,
              }}
            />
            <div
              style={{
                fontSize: 22,
                textTransform: "uppercase",
                letterSpacing: 2,
                color: "#94a3b8",
              }}
            >
              {project.status}
            </div>
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: truncatedTitle.length > 40 ? 52 : 64,
              fontWeight: 700,
              lineHeight: 1.1,
              marginBottom: 32,
              maxWidth: "100%",
              overflow: "hidden",
            }}
          >
            {truncatedTitle}
          </div>

          {/* Proposals */}
          {topProposals.length === 0 ? (
            <div
              style={{
                display: "flex",
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                color: "#94a3b8",
              }}
            >
              No proposals yet
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                flex: 1,
              }}
            >
              {topProposals.map((p) => {
                const up = Number(p.upvotes);
                const down = Number(p.downvotes);
                const total = up + down;
                const upPct = total > 0 ? (up / maxTotal) * 100 : 0;
                const downPct = total > 0 ? (down / maxTotal) * 100 : 0;
                const pTitle =
                  p.title.length > 50 ? p.title.slice(0, 50) + "…" : p.title;
                return (
                  <div
                    key={p.id}
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: 22,
                      }}
                    >
                      <div style={{ color: "#e2e8f0" }}>{pTitle}</div>
                      <div
                        style={{
                          display: "flex",
                          gap: 18,
                          fontSize: 20,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <span style={{ color: "#4ade80" }}>+{up}</span>
                        <span style={{ color: "#f87171" }}>−{down}</span>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        height: 12,
                        borderRadius: 6,
                        background: "rgba(148, 163, 184, 0.18)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${upPct}%`,
                          background: "#22c55e",
                        }}
                      />
                      <div
                        style={{
                          width: `${downPct}%`,
                          background: "#ef4444",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 24,
              paddingTop: 18,
              borderTop: "1px solid rgba(148, 163, 184, 0.2)",
              color: "#94a3b8",
              fontSize: 20,
            }}
          >
            <div style={{ display: "flex", gap: 32 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
                  {totalProposals}
                </span>
                <span>proposals</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
                  {totalVotes}
                </span>
                <span>votes</span>
              </div>
            </div>
            <div style={{ fontWeight: 600, color: "#e2e8f0" }}>Ideate</div>
          </div>
        </div>
      ),
      {
        ...SIZE,
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );

    return img;
  } catch (error) {
    ogLog.error({ err: error }, "OG image generation failed");
    return new Response("Failed to generate image", { status: 500 });
  }
}
