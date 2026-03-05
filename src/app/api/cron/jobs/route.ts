import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { process as processJobs } from "@/lib/queue";
import { registerEmbeddingHandlers, enqueueStaleRefresh } from "@/lib/embeddings/jobs";
import { pruneCiBuilds, checkCiBuildAlerts } from "@/lib/ci-builds";
import { dispatchToIntegrations } from "@/lib/integrations";
import { takeQualitySnapshot } from "@/lib/embeddings/quality-trends";

// Register handlers on module load so they're available when processJobs() runs
registerEmbeddingHandlers();

function verifyCronAuth(authHeader: string | null, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader ?? "", "utf-8");
  const b = Buffer.from(expected, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * POST /api/cron/jobs
 * Process pending background jobs.
 * Auth: Bearer token matching CRON_SECRET env var.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  if (!verifyCronAuth(auth, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run scheduled maintenance tasks
  const [result, ciPruned] = await Promise.all([
    processJobs(),
    pruneCiBuilds().catch(() => 0),
  ]);

  // Enqueue stale embedding refresh (processed in next run)
  await enqueueStaleRefresh().catch(() => {});

  // Take embedding quality snapshot (daily trend tracking)
  await takeQualitySnapshot().catch(() => null);

  // Check for CI build alerts and dispatch notifications
  const ciAlert = await checkCiBuildAlerts().catch(() => ({ alert: false, message: null }));
  if (ciAlert.alert && ciAlert.message) {
    await dispatchToIntegrations("build.completed" as never, {
      alert: true,
      message: ciAlert.message,
    }).catch(() => {});
  }

  return NextResponse.json({ ...result, ciBuildsDeleted: ciPruned, ciAlert: ciAlert.alert });
}
