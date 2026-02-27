/**
 * Smart search suggestions — autocomplete, typo tolerance, "did you mean".
 */
import { db } from "@/db";
import { searchSuggestions, projects, proposals, tags } from "@/db/schema";
import { desc, like, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "search-suggestions" });

export interface SearchSuggestion {
  text: string;
  type: "popular" | "entity" | "tag" | "correction";
  frequency?: number;
  entityType?: string;
}

/**
 * Get autocomplete suggestions for a partial query.
 * Combines popular searches, entity names, and tags.
 */
export async function getSuggestions(
  prefix: string,
  limit = 8
): Promise<SearchSuggestion[]> {
  if (!prefix || prefix.length < 1) return [];

  const normalized = prefix.toLowerCase().trim();
  const results: SearchSuggestion[] = [];

  try {
    // 1. Popular search queries matching prefix
    const popular = await db
      .select({
        query: searchSuggestions.query,
        frequency: searchSuggestions.frequency,
      })
      .from(searchSuggestions)
      .where(like(searchSuggestions.query, `${normalized}%`))
      .orderBy(desc(searchSuggestions.frequency))
      .limit(3);

    for (const row of popular) {
      results.push({
        text: row.query,
        type: "popular",
        frequency: row.frequency ?? 1,
      });
    }

    // 2. Project titles matching prefix
    const projectMatches = await db
      .select({ title: projects.title })
      .from(projects)
      .where(like(projects.title, `%${normalized}%`))
      .limit(2);

    for (const row of projectMatches) {
      if (!results.some((r) => r.text.toLowerCase() === row.title.toLowerCase())) {
        results.push({ text: row.title, type: "entity", entityType: "project" });
      }
    }

    // 3. Proposal titles matching prefix
    const proposalMatches = await db
      .select({ title: proposals.title })
      .from(proposals)
      .where(like(proposals.title, `%${normalized}%`))
      .limit(2);

    for (const row of proposalMatches) {
      if (!results.some((r) => r.text.toLowerCase() === row.title.toLowerCase())) {
        results.push({ text: row.title, type: "entity", entityType: "proposal" });
      }
    }

    // 4. Tag names matching prefix
    const tagMatches = await db
      .select({ name: tags.name })
      .from(tags)
      .where(like(tags.name, `%${normalized}%`))
      .limit(2);

    for (const row of tagMatches) {
      results.push({ text: row.name, type: "tag" });
    }
  } catch (err) {
    log.warn({ err }, "Failed to get search suggestions");
  }

  // 5. Typo correction: Levenshtein-based "did you mean"
  if (results.length === 0 && normalized.length >= 3) {
    const correction = await getTypoCorrection(normalized);
    if (correction) {
      results.push({ text: correction, type: "correction" });
    }
  }

  return results.slice(0, limit);
}

/**
 * Simple typo correction using common popular queries.
 * Uses edit distance approximation via SQLite.
 */
async function getTypoCorrection(query: string): Promise<string | null> {
  try {
    // Get recent popular queries and find closest match
    const candidates = await db
      .select({ query: searchSuggestions.query })
      .from(searchSuggestions)
      .where(sql`${searchSuggestions.frequency} >= 2`)
      .orderBy(desc(searchSuggestions.frequency))
      .limit(100);

    let bestMatch: string | null = null;
    let bestDist = Infinity;

    for (const row of candidates) {
      const dist = levenshteinDistance(query, row.query);
      if (dist < bestDist && dist <= Math.max(2, Math.floor(query.length / 3))) {
        bestDist = dist;
        bestMatch = row.query;
      }
    }

    return bestMatch;
  } catch {
    return null;
  }
}

/**
 * Levenshtein distance computation.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}
