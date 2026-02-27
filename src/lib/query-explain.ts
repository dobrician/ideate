import { db } from "@/db";
import { sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

export interface ExplainResult {
  query: string;
  plan: string[];
  usesIndex: boolean;
}

const COMMON_QUERIES = [
  // Original queries
  {
    name: "Projects by deadline",
    query: "SELECT * FROM projects WHERE deadline > unixepoch() ORDER BY deadline ASC LIMIT 20",
  },
  {
    name: "Proposals by createdAt",
    query: "SELECT * FROM proposals ORDER BY created_at DESC LIMIT 20",
  },
  {
    name: "Votes by createdAt",
    query: "SELECT * FROM votes ORDER BY created_at DESC LIMIT 50",
  },
  {
    name: "Comments by proposal + createdAt",
    query: "SELECT * FROM comments WHERE proposal_id = 'x' ORDER BY created_at ASC",
  },
  {
    name: "Users by email lookup",
    query: "SELECT * FROM users WHERE email = 'x'",
  },
  {
    name: "Audit logs recent",
    query: "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20",
  },
  // FK join queries (Sprint 64 indexes)
  {
    name: "Proposals by projectId (FK)",
    query: "SELECT * FROM proposals WHERE project_id = 'x' ORDER BY created_at DESC",
  },
  {
    name: "Votes by proposalId (FK)",
    query: "SELECT * FROM votes WHERE proposal_id = 'x'",
  },
  {
    name: "Comments by proposalId (FK)",
    query: "SELECT * FROM comments WHERE proposal_id = 'x'",
  },
  {
    name: "Attachments by proposalId (FK)",
    query: "SELECT * FROM attachments WHERE proposal_id = 'x'",
  },
  {
    name: "Team members by teamId (FK)",
    query: "SELECT * FROM team_members WHERE team_id = 'x'",
  },
  {
    name: "Teams by ownerId (FK)",
    query: "SELECT * FROM teams WHERE owner_id = 'x'",
  },
  {
    name: "Webhook deliveries by webhookId (FK)",
    query: "SELECT * FROM webhook_deliveries WHERE webhook_id = 'x'",
  },
  {
    name: "OAuth accounts by userId (FK)",
    query: "SELECT * FROM oauth_accounts WHERE user_id = 'x'",
  },
  {
    name: "Notification preferences by userId (FK)",
    query: "SELECT * FROM notification_preferences WHERE user_id = 'x'",
  },
  {
    name: "Audit logs by userId (FK)",
    query: "SELECT * FROM audit_logs WHERE user_id = 'x' ORDER BY created_at DESC LIMIT 20",
  },
] as const;

export interface QueryExplainEntry {
  name: string;
  query: string;
  plan: string[];
  usesIndex: boolean;
}

export function getQueryExplainPlans(): QueryExplainEntry[] {
  const results: QueryExplainEntry[] = [];
  for (const { name, query } of COMMON_QUERIES) {
    try {
      const rows = db.all<{ detail: string }>(
        sql.raw(`EXPLAIN QUERY PLAN ${query}`),
      );
      const plan = rows.map((r) => r.detail ?? String(Object.values(r).join(" | ")));
      const usesIndex = plan.some((line) => /USING.*INDEX/i.test(line));
      results.push({ name, query, plan, usesIndex });
    } catch (err) {
      logger.warn({ err, query: name }, "Failed to explain query");
      results.push({ name, query, plan: ["Error: could not explain"], usesIndex: false });
    }
  }
  return results;
}

export function getQueryExplainSummary(): { total: number; indexed: number; fullScan: number } {
  const plans = getQueryExplainPlans();
  const indexed = plans.filter((p) => p.usesIndex).length;
  return { total: plans.length, indexed, fullScan: plans.length - indexed };
}

export function listIndexes(): { name: string; tableName: string; sql: string | null }[] {
  try {
    const rows = db.all<{ name: string; tbl_name: string; sql: string | null }>(
      sql`SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' ORDER BY tbl_name, name`,
    );
    return rows.map((r) => ({ name: r.name, tableName: r.tbl_name, sql: r.sql }));
  } catch (err) {
    logger.warn({ err }, "Failed to list indexes");
    return [];
  }
}
