import Database from "better-sqlite3";
import { resolve } from "path";

const DB_PATH = process.env.DATABASE_URL ?? resolve("data/ideate.db");

interface SearchResult {
  id: string;
  title: string;
  description: string | null;
  type: "project" | "proposal";
  snippet: string;
  projectId?: string;
}

/**
 * Full-text search across projects and proposals using SQLite FTS5.
 * Falls back to LIKE queries if FTS tables don't exist.
 *
 * @param query - Search terms
 * @param limit - Max results (default 20)
 * @returns Ranked search results with highlighted snippets
 */
export function search(query: string, limit = 20): SearchResult[] {
  if (!query || query.trim().length < 2) return [];

  const sqlite = new Database(DB_PATH, { readonly: true });
  sqlite.pragma("busy_timeout = 3000");

  try {
    return searchFts(sqlite, query, limit);
  } catch {
    try {
      return searchFallback(sqlite, query, limit);
    } catch {
      return [];
    }
  } finally {
    sqlite.close();
  }
}

function searchFts(
  sqlite: Database.Database,
  query: string,
  limit: number
): SearchResult[] {
  const safeQuery = query.replace(/['"]/g, "").trim();
  const ftsQuery = safeQuery
    .split(/\s+/)
    .map((term) => `"${term}"*`)
    .join(" ");

  const projectResults = sqlite
    .prepare(
      `SELECT p.id, p.title, p.description,
              snippet(projects_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
       FROM projects_fts
       JOIN projects p ON p.rowid = projects_fts.rowid
       WHERE projects_fts MATCH ?
       ORDER BY rank
       LIMIT ?`
    )
    .all(ftsQuery, limit) as Array<{
    id: string;
    title: string;
    description: string | null;
    snippet: string;
  }>;

  const proposalResults = sqlite
    .prepare(
      `SELECT p.id, p.title, p.description, p.projectId,
              snippet(proposals_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
       FROM proposals_fts
       JOIN proposals p ON p.rowid = proposals_fts.rowid
       WHERE proposals_fts MATCH ?
       ORDER BY rank
       LIMIT ?`
    )
    .all(ftsQuery, limit) as Array<{
    id: string;
    title: string;
    description: string | null;
    projectId: string;
    snippet: string;
  }>;

  const results: SearchResult[] = [
    ...projectResults.map((r) => ({
      ...r,
      type: "project" as const,
    })),
    ...proposalResults.map((r) => ({
      ...r,
      type: "proposal" as const,
      projectId: r.projectId,
    })),
  ];

  return results.slice(0, limit);
}

function searchFallback(
  sqlite: Database.Database,
  query: string,
  limit: number
): SearchResult[] {
  const pattern = `%${query}%`;

  const projectResults = sqlite
    .prepare(
      `SELECT id, title, description
       FROM projects
       WHERE title LIKE ? OR description LIKE ?
       LIMIT ?`
    )
    .all(pattern, pattern, limit) as Array<{
    id: string;
    title: string;
    description: string | null;
  }>;

  const proposalResults = sqlite
    .prepare(
      `SELECT id, title, description, projectId
       FROM proposals
       WHERE title LIKE ? OR description LIKE ?
       LIMIT ?`
    )
    .all(pattern, pattern, limit) as Array<{
    id: string;
    title: string;
    description: string | null;
    projectId: string;
  }>;

  return [
    ...projectResults.map((r) => ({
      ...r,
      type: "project" as const,
      snippet: r.title,
    })),
    ...proposalResults.map((r) => ({
      ...r,
      type: "proposal" as const,
      snippet: r.title,
      projectId: r.projectId,
    })),
  ].slice(0, limit);
}

/**
 * Rebuild FTS index from source tables.
 * Run this once after migration to populate FTS with existing data.
 */
export function rebuildSearchIndex(): void {
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("busy_timeout = 5000");

  try {
    sqlite.exec(`
      INSERT INTO projects_fts(projects_fts) VALUES('rebuild');
      INSERT INTO proposals_fts(proposals_fts) VALUES('rebuild');
    `);
  } finally {
    sqlite.close();
  }
}
