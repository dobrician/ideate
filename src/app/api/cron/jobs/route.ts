import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { process as processJobs } from "@/lib/queue";

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

  const result = await processJobs();
  return NextResponse.json(result);
}
