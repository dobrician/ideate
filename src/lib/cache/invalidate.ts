/**
 * Cache invalidation helpers.
 * Call these after data mutations to keep the cache consistent.
 */

import { cacheDelete, getMemoryKeys } from "@/lib/cache";
import { invalidateTag } from "@/lib/cache/tags";
import { logger } from "@/lib/logger";

/** Invalidate cache entries for a project and its related data. */
export function invalidateProject(projectId: string): void {
  const keys = [
    `project:${projectId}`,
    `project:${projectId}:proposals`,
    `project:${projectId}:votes`,
    `dashboard:projects`,
  ];
  for (const key of keys) {
    cacheDelete(key);
  }
  invalidateTag(`project:${projectId}`);
  logger.info({ projectId }, "Cache invalidated for project");
}

/** Invalidate cache entries for a proposal and its parent project. */
export function invalidateProposal(proposalId: string, projectId: string): void {
  const keys = [
    `proposal:${proposalId}`,
    `project:${projectId}:proposals`,
    `project:${projectId}:votes`,
    `dashboard:projects`,
  ];
  for (const key of keys) {
    cacheDelete(key);
  }
  invalidateTag(`proposal:${proposalId}`);
  logger.info({ proposalId, projectId }, "Cache invalidated for proposal");
}

/** Invalidate cache entries after a vote change. */
export function invalidateVote(proposalId: string, projectId: string): void {
  const keys = [
    `proposal:${proposalId}`,
    `proposal:${proposalId}:votes`,
    `project:${projectId}:votes`,
  ];
  for (const key of keys) {
    cacheDelete(key);
  }
  logger.info({ proposalId, projectId }, "Cache invalidated for vote");
}

/**
 * Invalidate all cache entries matching a key prefix.
 * Scans the in-memory cache layer for matching keys.
 * Returns the number of keys invalidated.
 */
export function invalidateByPrefix(prefix: string): number {
  const allKeys = getMemoryKeys();
  let count = 0;
  for (const key of allKeys) {
    if (key.startsWith(prefix)) {
      cacheDelete(key);
      count++;
    }
  }
  logger.info({ prefix, count }, "Cache prefix invalidation");
  return count;
}
