/**
 * Cloudflare D1-compatible full-text search for Ideate.
 *
 * Mirrors the interface of `./search.ts` but uses D1 bindings
 * instead of better-sqlite3. D1 supports FTS5 natively.
 *
 * Usage:
 *   import { searchD1 } from "@/lib/search-d1";
 *   const results = await searchD1(env.DB, query, 20);
 */

interface SearchResult {
  id: string;
  title: string;
  description: string | null;
  type: "project" | "proposal" | "comment";
  snippet: string;
  projectId?: string;
}

/**
 * Full-text search using D1's FTS5 support.
 * Falls back to LIKE queries if FTS tables don't exist.
 */
export async function searchD1(
  db: D1Database,
  query: string,
  limit = 20
): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    return await searchFtsD1(db, query, limit);
  } catch {
    try {
      return await searchFallbackD1(db, query, limit);
    } catch {
      return [];
    }
  }
}

async function searchFtsD1(
  db: D1Database,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const safeQuery = query.replace(/['"]/g, "").trim();
  const ftsQuery = safeQuery
    .split(/\s+/)
    .map((term) => `"${term}"*`)
    .join(" ");

  const [projectRows, proposalRows, commentRows] = await Promise.all([
    db
      .prepare(
        `SELECT p.id, p.title, p.description,
                snippet(projects_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
         FROM projects_fts
         JOIN projects p ON p.rowid = projects_fts.rowid
         WHERE projects_fts MATCH ?1
         ORDER BY rank LIMIT ?2`
      )
      .bind(ftsQuery, limit)
      .all<{ id: string; title: string; description: string | null; snippet: string }>(),
    db
      .prepare(
        `SELECT p.id, p.title, p.description, p.project_id as projectId,
                snippet(proposals_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
         FROM proposals_fts
         JOIN proposals p ON p.rowid = proposals_fts.rowid
         WHERE proposals_fts MATCH ?1
         ORDER BY rank LIMIT ?2`
      )
      .bind(ftsQuery, limit)
      .all<{ id: string; title: string; description: string | null; projectId: string; snippet: string }>(),
    db
      .prepare(
        `SELECT c.id, c.content, c.project_id as projectId,
                snippet(comments_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
         FROM comments_fts
         JOIN comments c ON c.rowid = comments_fts.rowid
         WHERE comments_fts MATCH ?1
         ORDER BY rank LIMIT ?2`
      )
      .bind(ftsQuery, limit)
      .all<{ id: string; content: string; projectId: string | null; snippet: string }>()
      .catch(() => ({ results: [] as { id: string; content: string; projectId: string | null; snippet: string }[] })),
  ]);

  const results: SearchResult[] = [
    ...projectRows.results.map((r) => ({
      ...r,
      type: "project" as const,
    })),
    ...proposalRows.results.map((r) => ({
      ...r,
      type: "proposal" as const,
      projectId: r.projectId,
    })),
    ...commentRows.results.map((r) => ({
      id: r.id,
      title: r.content.slice(0, 80) + (r.content.length > 80 ? "..." : ""),
      description: r.content,
      type: "comment" as const,
      snippet: r.snippet,
      projectId: r.projectId ?? undefined,
    })),
  ];

  return results.slice(0, limit);
}

async function searchFallbackD1(
  db: D1Database,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const pattern = `%${query}%`;

  const [projectRows, proposalRows, commentRows] = await Promise.all([
    db
      .prepare(
        `SELECT id, title, description FROM projects
         WHERE title LIKE ?1 OR description LIKE ?1 LIMIT ?2`
      )
      .bind(pattern, limit)
      .all<{ id: string; title: string; description: string | null }>(),
    db
      .prepare(
        `SELECT id, title, description, project_id as projectId FROM proposals
         WHERE title LIKE ?1 OR description LIKE ?1 LIMIT ?2`
      )
      .bind(pattern, limit)
      .all<{ id: string; title: string; description: string | null; projectId: string }>(),
    db
      .prepare(
        `SELECT id, content, project_id FROM comments
         WHERE content LIKE ?1 LIMIT ?2`
      )
      .bind(pattern, limit)
      .all<{ id: string; content: string; project_id: string | null }>()
      .catch(() => ({ results: [] as { id: string; content: string; project_id: string | null }[] })),
  ]);

  return [
    ...projectRows.results.map((r) => ({
      ...r,
      type: "project" as const,
      snippet: r.title,
    })),
    ...proposalRows.results.map((r) => ({
      ...r,
      type: "proposal" as const,
      snippet: r.title,
      projectId: r.projectId,
    })),
    ...commentRows.results.map((r) => ({
      id: r.id,
      title: r.content.slice(0, 80) + (r.content.length > 80 ? "..." : ""),
      description: r.content,
      type: "comment" as const,
      snippet: r.content.slice(0, 100),
      projectId: r.project_id ?? undefined,
    })),
  ].slice(0, limit);
}
