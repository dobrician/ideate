// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryExplainPanel } from "@/app/admin/performance/query-explain-panel";

vi.mock("@/lib/use-locale", () => ({
  useLocale: () => ({
    t: (key: string, vars?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        "performance.explainPlans": "Query Explain Plans",
        "performance.explainDesc": `${vars?.indexed} of ${vars?.total} queries use indexes`,
        "performance.indexed": "Uses index",
        "performance.fullScan": "Full table scan",
        "performance.indexes": "Database Indexes",
        "performance.indexCount": `${vars?.count} indexes defined`,
        "performance.indexName": "Index",
        "performance.tableName": "Table",
        "performance.definition": "Definition",
      };
      return translations[key] ?? key;
    },
    locale: "en",
  }),
}));

const mockPlans = [
  {
    name: "Projects by deadline",
    query: "SELECT * FROM projects WHERE deadline > unixepoch()",
    plan: ["SEARCH projects USING INDEX idx_projects_deadline"],
    usesIndex: true,
  },
  {
    name: "Full scan query",
    query: "SELECT * FROM proposals",
    plan: ["SCAN proposals"],
    usesIndex: false,
  },
];

const mockIndexes = [
  {
    name: "idx_projects_deadline",
    tableName: "projects",
    sql: "CREATE INDEX idx_projects_deadline ON projects(deadline)",
  },
];

describe("QueryExplainPanel", () => {
  it("renders explain plans with index status", () => {
    render(<QueryExplainPanel explainPlans={mockPlans} indexes={mockIndexes} />);

    expect(screen.getByText("Query Explain Plans")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 queries use indexes")).toBeInTheDocument();
    expect(screen.getByText("Projects by deadline")).toBeInTheDocument();
    expect(screen.getByText("Full scan query")).toBeInTheDocument();
    expect(screen.getByText("Uses index")).toBeInTheDocument();
    expect(screen.getByText("Full table scan")).toBeInTheDocument();
  });

  it("renders database indexes table", () => {
    render(<QueryExplainPanel explainPlans={mockPlans} indexes={mockIndexes} />);

    expect(screen.getByText("Database Indexes")).toBeInTheDocument();
    expect(screen.getByText("1 indexes defined")).toBeInTheDocument();
    expect(screen.getByText("idx_projects_deadline")).toBeInTheDocument();
  });

  it("renders empty state when no plans", () => {
    render(<QueryExplainPanel explainPlans={[]} indexes={[]} />);

    expect(screen.getByText("0 of 0 queries use indexes")).toBeInTheDocument();
    expect(screen.getByText("0 indexes defined")).toBeInTheDocument();
  });
});
