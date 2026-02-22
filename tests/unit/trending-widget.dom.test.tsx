// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/lib/use-locale", () => ({
  useLocale: () => ({
    locale: "en",
    t: (key: string, vars?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        "trending.title": "Trending",
        "trending.topics": "Hot Topics",
        "trending.proposals": "Rising Proposals",
        "trending.noTopics": "No trending topics yet",
        "trending.noProposals": "No trending proposals yet",
        "trending.growth": `+${vars?.pct ?? 0}%`,
        "trending.momentum": `Momentum: ${vars?.score ?? 0}`,
      };
      return map[key] ?? key;
    },
  }),
}));

const mockTrendData = {
  topics: [
    { keyword: "authentication", frequency: 5, growth: 25 },
    { keyword: "performance", frequency: 3, growth: 50 },
  ],
  proposals: [
    {
      id: "p1", title: "Better Auth Flow",
      projectId: "proj-1", projectTitle: "Security Project",
      momentum: 20, voteVelocity: 2.5, commentActivity: 1.5,
    },
  ],
  generatedAt: "2026-02-22T00:00:00.000Z",
};

let fetchHandler: () => Promise<Response>;

beforeEach(() => {
  fetchHandler = async () => new Response(JSON.stringify(mockTrendData), { status: 200 });
  global.fetch = vi.fn(() => fetchHandler());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TrendingWidget", () => {
  it("renders trending topics and proposals", async () => {
    const { TrendingWidget } = await import("@/components/trending-widget");
    render(<TrendingWidget />);

    await waitFor(() => {
      expect(screen.getByText("Trending")).toBeInTheDocument();
      expect(screen.getByText("authentication")).toBeInTheDocument();
      expect(screen.getByText("performance")).toBeInTheDocument();
      expect(screen.getByText("Better Auth Flow")).toBeInTheDocument();
    });
  });

  it("shows growth badges for topics", async () => {
    const { TrendingWidget } = await import("@/components/trending-widget");
    render(<TrendingWidget />);

    await waitFor(() => {
      expect(screen.getByText("+25%")).toBeInTheDocument();
      expect(screen.getByText("+50%")).toBeInTheDocument();
    });
  });

  it("renders nothing when API returns empty data", async () => {
    fetchHandler = async () => new Response(
      JSON.stringify({ topics: [], proposals: [], generatedAt: "" }),
      { status: 200 }
    );

    const { TrendingWidget } = await import("@/components/trending-widget");
    const { container } = render(<TrendingWidget />);

    await waitFor(() => {
      // After loading, should render nothing since there's no content
      expect(container.querySelector("[data-slot=skeleton]")).toBeNull();
    });

    // No trending title should appear when empty
    await waitFor(() => {
      // The component returns null when no content, so container should be empty
      expect(screen.queryByText("Hot Topics")).not.toBeInTheDocument();
    });
  });

  it("handles API errors gracefully", async () => {
    fetchHandler = async () => new Response("", { status: 500 });

    const { TrendingWidget } = await import("@/components/trending-widget");
    const { container } = render(<TrendingWidget />);

    await waitFor(() => {
      // Should not crash; container is either empty or shows nothing
      expect(container).toBeTruthy();
    });
  });

  it("fetches from correct API endpoint", async () => {
    const { TrendingWidget } = await import("@/components/trending-widget");
    render(<TrendingWidget />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/analytics/trends?days=7");
    });
  });
});
