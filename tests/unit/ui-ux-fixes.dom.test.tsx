// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ── Mocks ──────────────────────────────────────────────────────

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
    t: (key: string, vars?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        "charts.votesOverTime": "Votes Over Time",
        "charts.topProposals": "Top Proposals",
        "charts.activityHeatmap": "Activity (Last 30 Days)",
        "charts.actions": "Actions",
        "charts.noData": "No data available yet",
        "vote.pro": "Pro",
        "vote.contra": "Contra",
        "comments.noComments": "No comments yet.",
        "comments.newMessages": "New messages",
        "comments.placeholder": "Add a comment...",
        "comments.submit": "Post Comment",
        "comments.replyPlaceholder": "Write a reply...",
        "comments.replyingTo": `Replying to ${vars?.name ?? ""}`,
        "common.cancel": "Cancel",
        "profile.tabAccount": "Account",
        "profile.tabSecurity": "Security",
        "profile.tabNotifications": "Notifications",
        "profile.tabProjects": "Projects",
        "profile.tabProposals": "Proposals",
        "profile.account": "Account",
        "profile.email": "Email",
        "profile.role": "Role",
        "profile.memberSince": "Member Since",
        "profile.displayName": "Display Name",
        "profile.noProjects": "No projects yet",
        "profile.noProposals": "No proposals yet",
        "profile.yourProjects": `Your Projects (${vars?.count ?? 0})`,
        "profile.yourProposals": `Your Proposals (${vars?.count ?? 0})`,
        "profile.showMore": "Show more",
        "profile.showLess": "Show less",
        "profile.noPasswordSet": "No password set for this account",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("@/lib/csrf-client", () => ({
  getCsrfTokenClient: () => "mock-csrf",
}));

vi.mock("@/app/projects/[id]/proposals/comment-actions", () => ({
  addComment: vi.fn(async () => ({ success: true })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/use-keyboard-inset", () => ({
  useKeyboardInset: () => {},
}));

// ── Imports after mocks ─────────────────────────────────────────

import {
  VotesOverTimeChart,
  TopProposalsChart,
  ActivityHeatmapChart,
} from "@/app/dashboard/charts";
import { CommentThread } from "@/components/comment-thread";

// ============================================================
// #70 — Chart accessibility: role="img" + aria-label
// ============================================================

describe("Chart accessibility (#70)", () => {
  describe("VotesOverTimeChart", () => {
    it("has role=img with aria-label when data present", () => {
      const { container } = render(
        <VotesOverTimeChart data={[{ date: "2026-02-01", pro: 5, contra: 2 }]} />
      );
      const imgEl = container.querySelector("[role='img']");
      expect(imgEl).toBeTruthy();
      expect(imgEl!.getAttribute("aria-label")).toBe("Votes Over Time");
    });

    it("does not render role=img for empty state", () => {
      const { container } = render(<VotesOverTimeChart data={[]} />);
      const imgEl = container.querySelector("[role='img']");
      expect(imgEl).toBeNull();
    });
  });

  describe("TopProposalsChart", () => {
    it("has role=img with aria-label when data present", () => {
      const { container } = render(
        <TopProposalsChart
          data={[{ title: "Proposal A", pro: 10, contra: 3 }]}
        />
      );
      const imgEl = container.querySelector("[role='img']");
      expect(imgEl).toBeTruthy();
      expect(imgEl!.getAttribute("aria-label")).toBe("Top Proposals");
    });

    it("does not render role=img for empty state", () => {
      const { container } = render(<TopProposalsChart data={[]} />);
      const imgEl = container.querySelector("[role='img']");
      expect(imgEl).toBeNull();
    });
  });

  describe("ActivityHeatmapChart", () => {
    it("has role=img with aria-label when data present", () => {
      const { container } = render(
        <ActivityHeatmapChart data={[{ date: "2026-02-01", count: 8 }]} />
      );
      const imgEl = container.querySelector("[role='img']");
      expect(imgEl).toBeTruthy();
      expect(imgEl!.getAttribute("aria-label")).toBe("Activity (Last 30 Days)");
    });

    it("does not render role=img for empty state", () => {
      const { container } = render(<ActivityHeatmapChart data={[]} />);
      const imgEl = container.querySelector("[role='img']");
      expect(imgEl).toBeNull();
    });
  });
});

// ============================================================
// #61 — Charts: responsive margins & font sizes (source check)
// ============================================================

describe("Chart responsive margins (#61)", () => {
  it("charts source uses margin left: -10 for compact mobile", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/app/dashboard/charts.tsx", "utf-8");
    // All charts use left: -10
    const leftMargins = src.match(/left:\s*-10/g);
    expect(leftMargins).toBeTruthy();
    expect(leftMargins!.length).toBeGreaterThanOrEqual(3);
  });

  it("charts source uses fontSize: 11", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/app/dashboard/charts.tsx", "utf-8");
    expect(src).toContain("fontSize: 11");
    // Should not have the old fontSize: 12 in tick elements
    // (Tooltip and Legend may still use 12, that's fine)
  });

  it("TopProposals YAxis truncates labels > 15 chars", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/app/dashboard/charts.tsx", "utf-8");
    expect(src).toContain("v.slice(0, 15)");
    expect(src).toContain('`${v.slice(0, 15)}...`');
  });
});

// ============================================================
// #66 — Comment thread empty state spacing
// ============================================================

describe("Comment thread empty state (#66)", () => {
  it("renders compact empty state with small icon", () => {
    const { container } = render(
      <CommentThread
        comments={[]}
        hiddenFields={{ projectId: "p1", proposalId: "pr1" }}
        currentUserId="u1"
      />
    );
    expect(screen.getByText("No comments yet.")).toBeInTheDocument();
    // Icon should be h-6 w-6 (small)
    const icon = container.querySelector("svg");
    expect(icon).toBeTruthy();
    expect(icon!.classList.contains("h-6")).toBe(true);
    expect(icon!.classList.contains("w-6")).toBe(true);
  });
});

// ============================================================
// Edge cases: long text, XSS, unicode, RTL, emoji, numbers
// ============================================================

describe("Edge case rendering", () => {
  describe("Charts with edge-case data", () => {
    it("renders chart with very long proposal title", () => {
      const longTitle = "A".repeat(200);
      render(
        <TopProposalsChart
          data={[{ title: longTitle, pro: 5, contra: 2 }]}
        />
      );
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    });

    it("renders chart with unicode/emoji in title", () => {
      render(
        <TopProposalsChart
          data={[{ title: "Idea: Build 🚀 rocket", pro: 10, contra: 0 }]}
        />
      );
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    });

    it("renders chart with XSS-like title", () => {
      render(
        <TopProposalsChart
          data={[
            {
              title: '<script>alert("xss")</script>',
              pro: 1,
              contra: 0,
            },
          ]}
        />
      );
      // Should render without executing scripts
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    });

    it("renders chart with RTL text", () => {
      render(
        <TopProposalsChart
          data={[{ title: "مشروع التصميم", pro: 3, contra: 1 }]}
        />
      );
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    });

    it("renders chart with special characters", () => {
      render(
        <TopProposalsChart
          data={[
            {
              title: "Feature: foo & bar <baz> \"quotes\"",
              pro: 2,
              contra: 0,
            },
          ]}
        />
      );
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    });

    it("renders chart with zero votes", () => {
      render(
        <TopProposalsChart data={[{ title: "Zero", pro: 0, contra: 0 }]} />
      );
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    });

    it("renders chart with very large vote numbers", () => {
      render(
        <TopProposalsChart
          data={[{ title: "Popular", pro: 999999, contra: 888888 }]}
        />
      );
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    });

    it("renders chart with many data points", () => {
      const data = Array.from({ length: 365 }, (_, i) => ({
        date: `2026-${String(Math.floor(i / 30) + 1).padStart(2, "0")}-${String((i % 30) + 1).padStart(2, "0")}`,
        pro: Math.floor(Math.random() * 100),
        contra: Math.floor(Math.random() * 50),
      }));
      render(<VotesOverTimeChart data={data} />);
      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    });
  });

  describe("Comment thread with edge-case content", () => {
    it("renders with empty hiddenFields", () => {
      render(
        <CommentThread
          comments={[]}
          hiddenFields={{}}
          currentUserId="u1"
        />
      );
      expect(screen.getByText("No comments yet.")).toBeInTheDocument();
    });

    it("renders without currentUserId", () => {
      render(
        <CommentThread
          comments={[]}
          hiddenFields={{ projectId: "p1" }}
        />
      );
      expect(screen.getByText("No comments yet.")).toBeInTheDocument();
    });

    it("renders textarea with correct placeholder", () => {
      render(
        <CommentThread
          comments={[]}
          hiddenFields={{ projectId: "p1" }}
          currentUserId="u1"
        />
      );
      const textarea = screen.getByPlaceholderText("Add a comment...");
      expect(textarea).toBeInTheDocument();
    });
  });
});
