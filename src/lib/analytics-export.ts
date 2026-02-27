/**
 * Analytics export — CSV generation for search analytics and CI build trends.
 * Used by admin export endpoints to provide downloadable data.
 */
import {
  getSearchStats,
  getPopularSearches,
  getZeroResultSearches,
} from "@/lib/search/analytics";
import {
  getSearchQualityStats,
  getSearchFeedbackTrend,
  getLowRatedResults,
} from "@/lib/search/quality";
import { getRecentCiBuilds, getCiBuildStats } from "@/lib/ci-builds";
import { getBundleSizeAnalytics } from "@/lib/bundle-tracker";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "analytics-export" });

/** Escape a CSV field (wrap in quotes if it contains commas, quotes, or newlines). */
function csvField(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build CSV string from header + rows. */
function buildCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(csvField).join(",");
  const dataLines = rows.map((row) => row.map(csvField).join(","));
  return [headerLine, ...dataLines].join("\n");
}

/**
 * Export search analytics as CSV.
 * Includes: stats summary, popular searches, zero-result searches,
 * quality feedback by mode, daily feedback trend, low-rated results.
 */
export async function exportSearchAnalyticsCsv(daysBack = 30): Promise<string> {
  const [stats, popular, zeroResult, quality, trend, lowRated] =
    await Promise.all([
      getSearchStats(daysBack),
      getPopularSearches(50, daysBack),
      getZeroResultSearches(50, daysBack),
      getSearchQualityStats(daysBack),
      getSearchFeedbackTrend(daysBack),
      getLowRatedResults(50, daysBack),
    ]);

  const sections: string[] = [];

  // Section 1: Summary
  sections.push("# Search Analytics Summary");
  sections.push(
    buildCsv(
      ["Metric", "Value"],
      [
        ["Total Searches", String(stats.totalSearches)],
        ["Unique Queries", String(stats.uniqueQueries)],
        ["Avg Response Time (ms)", String(stats.avgResponseTime)],
        ["Zero Result Rate (%)", stats.zeroResultRate.toFixed(1)],
        ["Click-Through Rate (%)", stats.clickThroughRate.toFixed(1)],
        ...Object.entries(stats.searchesByMode).map(([mode, count]) => [
          `Searches (${mode})`,
          String(count),
        ]),
      ]
    )
  );

  // Section 2: Popular Searches
  sections.push("\n# Popular Searches");
  sections.push(
    buildCsv(
      ["Query", "Count", "Avg Results"],
      popular.map((p) => [p.query, String(p.count), String(p.avgResults)])
    )
  );

  // Section 3: Zero-Result Searches
  sections.push("\n# Zero-Result Searches");
  sections.push(
    buildCsv(
      ["Query", "Count"],
      zeroResult.map((z) => [z.query, String(z.count)])
    )
  );

  // Section 4: Quality by Mode
  sections.push("\n# Quality Feedback by Mode");
  sections.push(
    buildCsv(
      ["Mode", "Positive", "Negative", "Total", "Positive Rate (%)"],
      Object.entries(quality.byMode).map(([mode, data]) => [
        mode,
        String(data.positive),
        String(data.negative),
        String(data.total),
        data.total > 0
          ? ((data.positive / data.total) * 100).toFixed(1)
          : "0",
      ])
    )
  );

  // Section 5: Daily Feedback Trend
  sections.push("\n# Daily Feedback Trend");
  sections.push(
    buildCsv(
      ["Date", "Positive", "Negative", "Total"],
      trend.map((d) => [
        d.date,
        String(d.positive),
        String(d.negative),
        String(d.total),
      ])
    )
  );

  // Section 6: Low-Rated Results
  sections.push("\n# Low-Rated Results");
  sections.push(
    buildCsv(
      ["Query", "Result ID", "Result Type", "Negative Count", "Positive Count"],
      lowRated.map((r) => [
        r.query,
        r.resultId,
        r.resultType,
        String(r.negativeCount),
        String(r.positiveCount),
      ])
    )
  );

  log.info({ daysBack, sections: sections.length }, "Search analytics CSV exported");
  return sections.join("\n");
}

/**
 * Export CI build trends as CSV.
 * Includes: build stats summary, recent builds list, bundle analytics.
 */
export async function exportCiBuildsCsv(limit = 50): Promise<string> {
  const [builds, stats, bundle] = await Promise.all([
    getRecentCiBuilds(limit),
    getCiBuildStats(limit),
    getBundleSizeAnalytics(),
  ]);

  const sections: string[] = [];

  // Section 1: Stats Summary
  sections.push("# CI Build Stats Summary");
  sections.push(
    buildCsv(
      ["Metric", "Value"],
      [
        ["Total Builds", String(stats.count)],
        ["Avg Duration (ms)", String(stats.avgDurationMs)],
        ["Min Duration (ms)", String(stats.minDurationMs)],
        ["Max Duration (ms)", String(stats.maxDurationMs)],
        ["Latest Duration (ms)", String(stats.latestDurationMs ?? "N/A")],
        ["Trend", stats.trend],
        ["Bundle Trend", bundle.trend],
        [
          "Current Bundle Size (MB)",
          bundle.current
            ? (bundle.current.sizeBytes / (1024 * 1024)).toFixed(1)
            : "N/A",
        ],
        [
          "Avg Bundle Size (MB)",
          bundle.avgSizeBytes
            ? (bundle.avgSizeBytes / (1024 * 1024)).toFixed(1)
            : "N/A",
        ],
      ]
    )
  );

  // Section 2: Recent Builds
  sections.push("\n# Recent CI Builds");
  sections.push(
    buildCsv(
      [
        "Commit Hash",
        "Branch",
        "Duration (ms)",
        "Size (bytes)",
        "Status",
        "Run ID",
        "Created At",
      ],
      builds.map((b) => [
        b.commitHash,
        b.branch,
        String(b.durationMs),
        String(b.buildSizeBytes ?? ""),
        b.status,
        b.runId ?? "",
        b.createdAt ? new Date(b.createdAt).toISOString() : "",
      ])
    )
  );

  log.info({ limit, buildCount: builds.length }, "CI builds CSV exported");
  return sections.join("\n");
}
