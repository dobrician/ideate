/**
 * Advanced search filters — extends FTS5 search with date, author, tag, vote count filtering.
 */
import Database from "better-sqlite3";
import { resolve } from "path";

const DB_PATH = process.env.DATABASE_URL ?? resolve("data/ideate.db");

export interface SearchFilters {
  dateFrom?: string;    // ISO date string
  dateTo?: string;      // ISO date string
  authorId?: string;    // user ID
  tags?: string[];      // tag names
  minVotes?: number;    // minimum vote count
  projectId?: string;   // search within specific project
  entityTypes?: Array<"project" | "proposal" | "comment">; // filter result types
  projectStatus?: "active" | "archived" | "draft";
}

export interface FilteredSearchResult {
  id: string;
  title: string;
  description: string | null;
  type: "project" | "proposal" | "comment";
  snippet: string;
  projectId?: string;
  authorId?: string;
  authorName?: string;
  voteCount?: number;
  tagNames?: string[];
  createdAt?: number;
  score: number;
}

/**
 * Perform filtered FTS5 search across projects, proposals, and comments.
 * Extends the basic search with WHERE clause filters.
 */
export function filteredSearch(
  query: string,
  filters: SearchFilters = {},
  limit = 20
): FilteredSearchResult[] {
  if (!query || query.trim().length < 2) return [];

  const sqlite = new Database(DB_PATH, { readonly: true });
  sqlite.pragma("busy_timeout = 3000");

  try {
    const results: FilteredSearchResult[] = [];
    const safeQuery = query.replace(/['"]/g, "").trim();
    const ftsQuery = safeQuery
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `"${term}"*`)
      .join(" ");

    if (!ftsQuery) return [];

    const types = filters.entityTypes ?? ["project", "proposal", "comment"];

    // Search projects
    if (types.includes("project")) {
      const projectResults = searchProjects(sqlite, ftsQuery, filters, limit);
      results.push(...projectResults);
    }

    // Search proposals
    if (types.includes("proposal")) {
      const proposalResults = searchProposals(sqlite, ftsQuery, filters, limit);
      results.push(...proposalResults);
    }

    // Search comments
    if (types.includes("comment")) {
      const commentResults = searchComments(sqlite, ftsQuery, filters, limit);
      results.push(...commentResults);
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  } catch {
    return [];
  } finally {
    sqlite.close();
  }
}

function searchProjects(
  sqlite: Database.Database,
  ftsQuery: string,
  filters: SearchFilters,
  limit: number
): FilteredSearchResult[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [ftsQuery];

  if (filters.dateFrom) {
    conditions.push("p.created_at >= ?");
    params.push(Math.floor(new Date(filters.dateFrom).getTime() / 1000));
  }
  if (filters.dateTo) {
    conditions.push("p.created_at <= ?");
    params.push(Math.floor(new Date(filters.dateTo).getTime() / 1000));
  }
  if (filters.authorId) {
    conditions.push("p.user_id = ?");
    params.push(filters.authorId);
  }
  if (filters.projectStatus) {
    conditions.push("p.status = ?");
    params.push(filters.projectStatus);
  }
  if (filters.projectId) {
    conditions.push("p.id = ?");
    params.push(filters.projectId);
  }
  if (filters.tags && filters.tags.length > 0) {
    const placeholders = filters.tags.map(() => "?").join(",");
    conditions.push(
      `p.id IN (SELECT pt.project_id FROM project_tags pt JOIN tags t ON t.id = pt.tag_id WHERE t.name IN (${placeholders}))`
    );
    params.push(...filters.tags);
  }

  const whereClause = conditions.length > 0 ? "AND " + conditions.join(" AND ") : "";
  params.push(limit);

  try {
    const rows = sqlite
      .prepare(
        `SELECT p.id, p.title, p.description, p.user_id as authorId, p.created_at as createdAt,
                snippet(projects_fts, 0, '<mark>', '</mark>', '...', 32) as snippet,
                u.first_name || ' ' || u.last_name as authorName,
                rank
         FROM projects_fts
         JOIN projects p ON p.rowid = projects_fts.rowid
         LEFT JOIN users u ON u.id = p.user_id
         WHERE projects_fts MATCH ?
         ${whereClause}
         ORDER BY rank
         LIMIT ?`
      )
      .all(...params) as Array<{
      id: string;
      title: string;
      description: string | null;
      authorId: string | null;
      createdAt: number | null;
      snippet: string;
      authorName: string | null;
      rank: number;
    }>;

    return rows.map((r, i) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      type: "project" as const,
      snippet: r.snippet,
      authorId: r.authorId ?? undefined,
      authorName: r.authorName ?? undefined,
      createdAt: r.createdAt ?? undefined,
      score: 1 - i / Math.max(rows.length, 1),
    }));
  } catch {
    return [];
  }
}

function searchProposals(
  sqlite: Database.Database,
  ftsQuery: string,
  filters: SearchFilters,
  limit: number
): FilteredSearchResult[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [ftsQuery];

  if (filters.dateFrom) {
    conditions.push("p.created_at >= ?");
    params.push(Math.floor(new Date(filters.dateFrom).getTime() / 1000));
  }
  if (filters.dateTo) {
    conditions.push("p.created_at <= ?");
    params.push(Math.floor(new Date(filters.dateTo).getTime() / 1000));
  }
  if (filters.authorId) {
    conditions.push("p.user_id = ?");
    params.push(filters.authorId);
  }
  if (filters.projectId) {
    conditions.push("p.project_id = ?");
    params.push(filters.projectId);
  }
  if (filters.minVotes !== undefined && filters.minVotes > 0) {
    conditions.push(
      `(SELECT COUNT(*) FROM votes v WHERE v.proposal_id = p.id) >= ?`
    );
    params.push(filters.minVotes);
  }
  if (filters.tags && filters.tags.length > 0) {
    const placeholders = filters.tags.map(() => "?").join(",");
    conditions.push(
      `p.id IN (SELECT pt.proposal_id FROM proposal_tags pt JOIN tags t ON t.id = pt.tag_id WHERE t.name IN (${placeholders}))`
    );
    params.push(...filters.tags);
  }

  const whereClause = conditions.length > 0 ? "AND " + conditions.join(" AND ") : "";
  params.push(limit);

  try {
    const rows = sqlite
      .prepare(
        `SELECT p.id, p.title, p.description, p.project_id as projectId,
                p.user_id as authorId, p.created_at as createdAt,
                snippet(proposals_fts, 0, '<mark>', '</mark>', '...', 32) as snippet,
                u.first_name || ' ' || u.last_name as authorName,
                (SELECT COALESCE(SUM(v.value), 0) FROM votes v WHERE v.proposal_id = p.id) as voteCount,
                rank
         FROM proposals_fts
         JOIN proposals p ON p.rowid = proposals_fts.rowid
         LEFT JOIN users u ON u.id = p.user_id
         WHERE proposals_fts MATCH ?
         ${whereClause}
         ORDER BY rank
         LIMIT ?`
      )
      .all(...params) as Array<{
      id: string;
      title: string;
      description: string | null;
      projectId: string;
      authorId: string | null;
      createdAt: number | null;
      snippet: string;
      authorName: string | null;
      voteCount: number;
      rank: number;
    }>;

    return rows.map((r, i) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      type: "proposal" as const,
      snippet: r.snippet,
      projectId: r.projectId,
      authorId: r.authorId ?? undefined,
      authorName: r.authorName ?? undefined,
      voteCount: r.voteCount,
      createdAt: r.createdAt ?? undefined,
      score: 1 - i / Math.max(rows.length, 1),
    }));
  } catch {
    return [];
  }
}

function searchComments(
  sqlite: Database.Database,
  ftsQuery: string,
  filters: SearchFilters,
  limit: number
): FilteredSearchResult[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [ftsQuery];

  if (filters.dateFrom) {
    conditions.push("c.created_at >= ?");
    params.push(Math.floor(new Date(filters.dateFrom).getTime() / 1000));
  }
  if (filters.dateTo) {
    conditions.push("c.created_at <= ?");
    params.push(Math.floor(new Date(filters.dateTo).getTime() / 1000));
  }
  if (filters.authorId) {
    conditions.push("c.user_id = ?");
    params.push(filters.authorId);
  }
  if (filters.projectId) {
    conditions.push("(c.project_id = ? OR c.proposal_id IN (SELECT id FROM proposals WHERE project_id = ?))");
    params.push(filters.projectId, filters.projectId);
  }

  const whereClause = conditions.length > 0 ? "AND " + conditions.join(" AND ") : "";
  params.push(limit);

  try {
    const rows = sqlite
      .prepare(
        `SELECT c.id, c.content, c.project_id as projectId, c.proposal_id as proposalId,
                c.user_id as authorId, c.created_at as createdAt,
                snippet(comments_fts, 0, '<mark>', '</mark>', '...', 32) as snippet,
                u.first_name || ' ' || u.last_name as authorName
         FROM comments_fts
         JOIN comments c ON c.rowid = comments_fts.rowid
         LEFT JOIN users u ON u.id = c.user_id
         WHERE comments_fts MATCH ?
         ${whereClause}
         ORDER BY rank
         LIMIT ?`
      )
      .all(...params) as Array<{
      id: string;
      content: string;
      projectId: string | null;
      proposalId: string | null;
      authorId: string | null;
      createdAt: number | null;
      snippet: string;
      authorName: string | null;
    }>;

    return rows.map((r, i) => {
      let projectId = r.projectId ?? undefined;
      if (!projectId && r.proposalId) {
        try {
          const row = sqlite
            .prepare("SELECT project_id FROM proposals WHERE id = ?")
            .get(r.proposalId) as { project_id: string } | undefined;
          projectId = row?.project_id;
        } catch { /* ignore */ }
      }
      return {
        id: r.id,
        title: r.content.slice(0, 80) + (r.content.length > 80 ? "..." : ""),
        description: r.content,
        type: "comment" as const,
        snippet: r.snippet,
        projectId,
        authorId: r.authorId ?? undefined,
        authorName: r.authorName ?? undefined,
        createdAt: r.createdAt ?? undefined,
        score: 0.8 * (1 - i / Math.max(rows.length, 1)), // slightly lower weight for comments
      };
    });
  } catch {
    return [];
  }
}
