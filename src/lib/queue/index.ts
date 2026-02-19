import { db } from "@/db";
import { jobQueue } from "@/db/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { randomUUID } from "crypto";

const log = logger.child({ module: "queue" });

export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

const handlers = new Map<string, JobHandler>();

/**
 * Register a handler for a job type.
 * Call this at module load time before processing jobs.
 */
export function registerHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

/**
 * Enqueue a new job for background processing.
 */
export async function enqueue(
  type: string,
  payload: Record<string, unknown> = {},
  options?: { runAt?: Date; maxAttempts?: number },
): Promise<string> {
  const id = randomUUID();
  await db.insert(jobQueue).values({
    id,
    type,
    payload: JSON.stringify(payload),
    status: "pending",
    attempts: 0,
    maxAttempts: options?.maxAttempts ?? 3,
    runAt: options?.runAt ?? new Date(),
  });
  log.info({ jobId: id, type }, "Job enqueued");
  return id;
}

/**
 * Process up to `batchSize` pending jobs that are due to run.
 * Returns the number of jobs processed (succeeded + failed).
 */
export async function process(batchSize = 10): Promise<{ processed: number; succeeded: number; failed: number }> {
  const now = new Date();
  const pending = await db
    .select()
    .from(jobQueue)
    .where(
      and(
        eq(jobQueue.status, "pending"),
        lte(jobQueue.runAt, now),
      ),
    )
    .limit(batchSize);

  let succeeded = 0;
  let failed = 0;

  for (const job of pending) {
    const handler = handlers.get(job.type);
    if (!handler) {
      log.warn({ jobId: job.id, type: job.type }, "No handler registered for job type");
      await db
        .update(jobQueue)
        .set({ status: "dead", lastError: `No handler for type: ${job.type}`, completedAt: now })
        .where(eq(jobQueue.id, job.id));
      failed++;
      continue;
    }

    // Mark as processing
    await db
      .update(jobQueue)
      .set({ status: "processing", startedAt: now, attempts: job.attempts + 1 })
      .where(eq(jobQueue.id, job.id));

    try {
      const payload = JSON.parse(job.payload) as Record<string, unknown>;
      await handler(payload);
      await db
        .update(jobQueue)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(jobQueue.id, job.id));
      log.info({ jobId: job.id, type: job.type }, "Job completed");
      succeeded++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const newAttempts = job.attempts + 1;
      if (newAttempts >= job.maxAttempts) {
        await db
          .update(jobQueue)
          .set({ status: "dead", lastError: errorMsg, completedAt: new Date() })
          .where(eq(jobQueue.id, job.id));
        log.error({ jobId: job.id, type: job.type, err }, "Job permanently failed");
      } else {
        // Schedule retry with exponential backoff: 30s, 120s, 270s...
        const backoffMs = 30_000 * newAttempts * newAttempts;
        const retryAt = new Date(Date.now() + backoffMs);
        await db
          .update(jobQueue)
          .set({ status: "pending", lastError: errorMsg, runAt: retryAt })
          .where(eq(jobQueue.id, job.id));
        log.warn({ jobId: job.id, type: job.type, retryAt }, "Job failed, scheduled retry");
      }
      failed++;
    }
  }

  return { processed: succeeded + failed, succeeded, failed };
}

/**
 * Retry a specific failed/dead job by resetting it to pending.
 */
export async function retry(jobId: string): Promise<boolean> {
  const [job] = await db
    .select()
    .from(jobQueue)
    .where(eq(jobQueue.id, jobId))
    .limit(1);

  if (!job) return false;
  if (job.status !== "failed" && job.status !== "dead") return false;

  await db
    .update(jobQueue)
    .set({ status: "pending", attempts: 0, lastError: null, runAt: new Date(), startedAt: null, completedAt: null })
    .where(eq(jobQueue.id, jobId));

  log.info({ jobId }, "Job reset for retry");
  return true;
}

/**
 * Get job queue statistics for monitoring.
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  dead: number;
}> {
  const [stats] = await db
    .select({
      pending: sql<number>`SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)`,
      processing: sql<number>`SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END)`,
      completed: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
      failed: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
      dead: sql<number>`SUM(CASE WHEN status = 'dead' THEN 1 ELSE 0 END)`,
    })
    .from(jobQueue);

  return {
    pending: Number(stats?.pending ?? 0),
    processing: Number(stats?.processing ?? 0),
    completed: Number(stats?.completed ?? 0),
    failed: Number(stats?.failed ?? 0),
    dead: Number(stats?.dead ?? 0),
  };
}
