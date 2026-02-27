/**
 * Job queue handlers for async embedding generation.
 * Registered at startup so background embedding jobs are processed automatically.
 */

import { db } from "@/db";
import { projects, proposals, comments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateEmbedding, storeEmbedding, getStaleEmbeddings } from "@/lib/embeddings";
import { registerHandler, enqueue } from "@/lib/queue";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "embedding-jobs" });

/** Build text content for embedding from an entity */
async function getEntityText(
  entityType: "project" | "proposal" | "comment",
  entityId: string
): Promise<string | null> {
  switch (entityType) {
    case "project": {
      const [row] = await db
        .select({ title: projects.title, description: projects.description })
        .from(projects)
        .where(eq(projects.id, entityId))
        .limit(1);
      if (!row) return null;
      return `${row.title} ${row.description ?? ""}`.trim();
    }
    case "proposal": {
      const [row] = await db
        .select({ title: proposals.title, description: proposals.description })
        .from(proposals)
        .where(eq(proposals.id, entityId))
        .limit(1);
      if (!row) return null;
      return `${row.title} ${row.description ?? ""}`.trim();
    }
    case "comment": {
      const [row] = await db
        .select({ content: comments.content })
        .from(comments)
        .where(eq(comments.id, entityId))
        .limit(1);
      if (!row) return null;
      return row.content;
    }
    default:
      return null;
  }
}

/**
 * Job handler: generate and store an embedding for an entity.
 */
async function handleGenerateEmbedding(
  payload: Record<string, unknown>
): Promise<void> {
  const entityType = payload.entityType as "project" | "proposal" | "comment";
  const entityId = payload.entityId as string;

  if (!entityType || !entityId) {
    throw new Error("Missing entityType or entityId in job payload");
  }

  const text = await getEntityText(entityType, entityId);
  if (!text) {
    log.warn({ entityType, entityId }, "Entity not found for embedding generation");
    return;
  }

  const { vector, model } = await generateEmbedding(text);
  await storeEmbedding(entityType, entityId, vector, model);
  log.info({ entityType, entityId, model, dims: vector.length }, "Embedding generated");
}

/**
 * Register all embedding-related job handlers.
 * Call once at application startup.
 */
export function registerEmbeddingHandlers(): void {
  registerHandler("generate_embedding", handleGenerateEmbedding);
  registerHandler("refresh_stale_embeddings", handleRefreshStale);
}

/**
 * Enqueue an embedding generation job for an entity.
 */
export async function enqueueEmbedding(
  entityType: "project" | "proposal" | "comment",
  entityId: string
): Promise<string> {
  return enqueue("generate_embedding", { entityType, entityId });
}

/**
 * Job handler: find and re-enqueue stale embeddings for regeneration.
 */
async function handleRefreshStale(): Promise<void> {
  const stale = await getStaleEmbeddings();
  log.info({ count: stale.length }, "Found stale embeddings for regeneration");

  for (const entry of stale) {
    await enqueue("generate_embedding", {
      entityType: entry.entityType,
      entityId: entry.entityId,
    });
  }
}

/**
 * Enqueue a stale embedding refresh job.
 */
export async function enqueueStaleRefresh(): Promise<string> {
  return enqueue("refresh_stale_embeddings", {});
}
