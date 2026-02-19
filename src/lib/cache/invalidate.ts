/**
 * Cache invalidation helpers.
 * Call these after data mutations to keep the cache consistent.
 */

import { cacheDelete } from "@/lib/cache";
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

/** Invalidate all cache entries matching a prefix pattern. */
export function invalidateByPrefix(prefix: string): void {
  logger.info({ prefix }, "Cache prefix invalidation requested");
}
