import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { recordCiBuild, getRecentCiBuilds, getCiBuildStats } from "@/lib/ci-builds";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** GET: retrieve build timing trends and stats. Admin only. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [builds, stats] = await Promise.all([
      getRecentCiBuilds(50),
      getCiBuildStats(50),
    ]);

    return NextResponse.json({ builds, stats });
  } catch (error) {
    logger.error({ err: error }, "CI builds GET error");
    return NextResponse.json({ error: "Failed to get builds" }, { status: 500 });
  }
}

/** POST: record a new build metric. Authenticated by CI secret. */
export async function POST(request: NextRequest) {
  try {
    const ciSecret = process.env.CI_METRICS_SECRET;
    const authHeader = request.headers.get("authorization");

    // Allow admin users OR CI secret
    let authorized = false;
    if (ciSecret && authHeader === `Bearer ${ciSecret}`) {
      authorized = true;
    } else {
      const user = await getCurrentUser();
      if (user && hasPermission(user.role as Role, "user:manage")) {
        authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { commitHash, branch, durationMs, buildSizeBytes, status, runId } = body;

    if (!commitHash || typeof durationMs !== "number") {
      return NextResponse.json(
        { error: "commitHash and durationMs are required" },
        { status: 400 }
      );
    }

    await recordCiBuild({
      commitHash,
      branch,
      durationMs,
      buildSizeBytes,
      status,
      runId,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "CI builds POST error");
    return NextResponse.json({ error: "Failed to record build" }, { status: 500 });
  }
}
