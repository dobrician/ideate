import Database from "better-sqlite3";
import { resolve } from "path";

const DB_PATH = process.env.DATABASE_URL ?? resolve("data/ideate.db");

interface SearchResult {
  id: string;
  title: string;
  description: string | null;
  type: "project" | "proposal" | "comment";
  snippet: string;
  projectId?: string;
}

/**
 * Full-text search across projects, proposals, and comments using SQLite FTS5.
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

  let commentResults: Array<{
    id: string;
    content: string;
    projectId: string | null;
    proposalId: string | null;
    snippet: string;
  }> = [];

  try {
    commentResults = sqlite
      .prepare(
        `SELECT c.id, c.content, c.project_id as projectId, c.proposal_id as proposalId,
                snippet(comments_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
         FROM comments_fts
         JOIN comments c ON c.rowid = comments_fts.rowid
         WHERE comments_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(ftsQuery, limit) as typeof commentResults;
  } catch {
    // comments_fts may not exist yet — skip gracefully
  }

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
    ...commentResults.map((r) => {
      // Resolve the projectId for comment navigation
      let projectId = r.projectId ?? undefined;
      if (!projectId && r.proposalId) {
        try {
          const row = sqlite
            .prepare("SELECT project_id FROM proposals WHERE id = ?")
            .get(r.proposalId) as { project_id: string } | undefined;
          projectId = row?.project_id;
        } catch {
          // ignore
        }
      }
      return {
        id: r.id,
        title: r.content.slice(0, 80) + (r.content.length > 80 ? "..." : ""),
        description: r.content,
        type: "comment" as const,
        snippet: r.snippet,
        projectId,
      };
    }),
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

  let commentResults: Array<{
    id: string;
    content: string;
    project_id: string | null;
  }> = [];

  try {
    commentResults = sqlite
      .prepare(
        `SELECT id, content, project_id
         FROM comments
         WHERE content LIKE ?
         LIMIT ?`
      )
      .all(pattern, limit) as typeof commentResults;
  } catch {
    // comments table may not exist in test environments
  }

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
    ...commentResults.map((r) => ({
      id: r.id,
      title: r.content.slice(0, 80) + (r.content.length > 80 ? "..." : ""),
      description: r.content,
      type: "comment" as const,
      snippet: r.content.slice(0, 100),
      projectId: r.project_id ?? undefined,
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
    try {
      sqlite.exec(
        `INSERT INTO comments_fts(comments_fts) VALUES('rebuild');`
      );
    } catch {
      // comments_fts may not exist yet
    }
  } finally {
    sqlite.close();
  }
}
