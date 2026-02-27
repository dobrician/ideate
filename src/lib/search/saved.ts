/**
 * Saved searches — CRUD for user-bookmarked search queries.
 */
import { db } from "@/db";
import { savedSearches } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  mode: "fts" | "semantic" | "hybrid";
  filters?: Record<string, unknown>;
  createdAt?: Date | null;
}

/**
 * Get all saved searches for a user.
 */
export async function getUserSavedSearches(userId: string): Promise<SavedSearch[]> {
  const rows = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, userId))
    .orderBy(desc(savedSearches.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    query: r.query,
    mode: r.mode,
    filters: r.filters ? JSON.parse(r.filters) : undefined,
    createdAt: r.createdAt,
  }));
}

/**
 * Create a saved search.
 */
export async function createSavedSearch(
  userId: string,
  data: { name: string; query: string; mode?: string; filters?: Record<string, unknown> }
): Promise<SavedSearch> {
  const id = randomUUID();
  const mode = (["fts", "semantic", "hybrid"].includes(data.mode ?? "") ? data.mode : "fts") as "fts" | "semantic" | "hybrid";

  await db.insert(savedSearches).values({
    id,
    userId,
    name: data.name.slice(0, 200),
    query: data.query.slice(0, 500),
    mode,
    filters: data.filters ? JSON.stringify(data.filters) : null,
  });

  return { id, name: data.name, query: data.query, mode, filters: data.filters };
}

/**
 * Delete a saved search (must belong to user).
 */
export async function deleteSavedSearch(userId: string, searchId: string): Promise<boolean> {
  const result = await db
    .delete(savedSearches)
    .where(and(eq(savedSearches.id, searchId), eq(savedSearches.userId, userId)));

  return (result?.changes ?? 0) > 0;
}
