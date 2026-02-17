// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock recharts to avoid canvas/SVG issues in jsdom
vi.mock("recharts", () => {
  const MockResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  );
  const MockLineChart = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  );
  const MockBarChart = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  );
  const MockLine = ({ name }: { name?: string }) => <div data-testid={`line-${name}`} />;
  const MockBar = ({ name }: { name?: string }) => <div data-testid={`bar-${name}`} />;
  const Noop = () => null;
  return {
    ResponsiveContainer: MockResponsiveContainer,
    LineChart: MockLineChart,
    BarChart: MockBarChart,
    Line: MockLine,
    Bar: MockBar,
    XAxis: Noop,
    YAxis: Noop,
    Tooltip: Noop,
    Legend: Noop,
    CartesianGrid: Noop,
  };
});

vi.mock("@/lib/use-locale", () => ({
  useLocale: () => ({
    locale: "en",
    t: (key: string) => {
      const map: Record<string, string> = {
        "charts.votesOverTime": "Votes Over Time",
        "charts.topProposals": "Top Proposals",
        "charts.activityHeatmap": "Activity (Last 30 Days)",
        "charts.actions": "Actions",
        "charts.noData": "No data available yet",
        "vote.pro": "Pro",
        "vote.contra": "Contra",
      };
      return map[key] ?? key;
    },
  }),
}));

import {
  VotesOverTimeChart,
  TopProposalsChart,
  ActivityHeatmapChart,
} from "@/app/dashboard/charts";

describe("VotesOverTimeChart", () => {
  it("shows empty state when no data", () => {
    render(<VotesOverTimeChart data={[]} />);
    expect(screen.getByText("Votes Over Time")).toBeInTheDocument();
    expect(screen.getByText("No data available yet")).toBeInTheDocument();
  });

  it("renders chart with data", () => {
    render(
      <VotesOverTimeChart
        data={[
          { date: "2026-02-01", pro: 5, contra: 2 },
          { date: "2026-02-02", pro: 3, contra: 1 },
        ]}
      />,
    );
    expect(screen.getByText("Votes Over Time")).toBeInTheDocument();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });
});

describe("TopProposalsChart", () => {
  it("shows empty state when no data", () => {
    render(<TopProposalsChart data={[]} />);
    expect(screen.getByText("Top Proposals")).toBeInTheDocument();
    expect(screen.getByText("No data available yet")).toBeInTheDocument();
  });

  it("renders chart with data", () => {
    render(
      <TopProposalsChart
        data={[
          { title: "Proposal A", pro: 10, contra: 3 },
          { title: "Proposal B", pro: 7, contra: 5 },
        ]}
      />,
    );
    expect(screen.getByText("Top Proposals")).toBeInTheDocument();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });
});

describe("ActivityHeatmapChart", () => {
  it("shows empty state when no data", () => {
    render(<ActivityHeatmapChart data={[]} />);
    expect(screen.getByText("Activity (Last 30 Days)")).toBeInTheDocument();
    expect(screen.getByText("No data available yet")).toBeInTheDocument();
  });

  it("renders chart with data", () => {
    render(
      <ActivityHeatmapChart
        data={[
          { date: "2026-02-01", count: 8 },
          { date: "2026-02-02", count: 12 },
        ]}
      />,
    );
    expect(screen.getByText("Activity (Last 30 Days)")).toBeInTheDocument();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });
});
