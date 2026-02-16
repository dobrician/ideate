import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { isNull } from "drizzle-orm";
import { generateProjectSummary } from "@/lib/project-summary";

const CRON_SECRET = process.env.CRON_SECRET;
const BATCH_SIZE = 5;

/**
 * GET /api/cron/project-summaries
 * Batch process up to 5 projects without summaries.
 * Auth: Bearer token matching CRON_SECRET env var.
 */
export async function GET(request: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await db
    .select({ id: projects.id })
    .from(projects)
    .where(isNull(projects.summary))
    .limit(BATCH_SIZE);

  let processed = 0;
  let errors = 0;

  for (const { id } of pending) {
    try {
      const result = await generateProjectSummary(id);
      if (result) processed++;
      else errors++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ processed, errors, total: pending.length });
}
