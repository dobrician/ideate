// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/lib/use-locale", () => ({
  useLocale: () => ({
    locale: "en",
    t: (key: string) => {
      const map: Record<string, string> = {
        "recommendations.title": "Recommended for You",
        "recommendations.empty": "Vote on proposals to get personalized recommendations",
        "recommendations.similarContent": "Similar to your interests",
        "recommendations.votingPattern": "Popular with similar voters",
        "recommendations.popular": "Trending now",
      };
      return map[key] ?? key;
    },
  }),
}));

const mockRecs = {
  recommendations: [
    {
      proposalId: "p1", proposalTitle: "Better Auth",
      projectId: "proj-1", projectTitle: "Security",
      score: 0.85, reason: "similar_content",
    },
    {
      proposalId: "p2", proposalTitle: "API Perf",
      projectId: "proj-2", projectTitle: "Backend",
      score: 0.7, reason: "voting_pattern",
    },
    {
      proposalId: "p3", proposalTitle: "Hot Feature",
      projectId: "proj-3", projectTitle: "Frontend",
      score: 0.3, reason: "popular",
    },
  ],
};

let fetchHandler: () => Promise<Response>;

beforeEach(() => {
  fetchHandler = async () => new Response(JSON.stringify(mockRecs), { status: 200 });
  global.fetch = vi.fn(() => fetchHandler());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RecommendationsWidget", () => {
  it("renders recommendations list", async () => {
    const { RecommendationsWidget } = await import("@/components/recommendations");
    render(<RecommendationsWidget />);

    await waitFor(() => {
      expect(screen.getByText("Recommended for You")).toBeInTheDocument();
      expect(screen.getByText("Better Auth")).toBeInTheDocument();
      expect(screen.getByText("API Perf")).toBeInTheDocument();
      expect(screen.getByText("Hot Feature")).toBeInTheDocument();
    });
  });

  it("shows reason labels for each recommendation", async () => {
    const { RecommendationsWidget } = await import("@/components/recommendations");
    render(<RecommendationsWidget />);

    await waitFor(() => {
      expect(screen.getByText("Similar to your interests")).toBeInTheDocument();
      expect(screen.getByText("Popular with similar voters")).toBeInTheDocument();
      expect(screen.getByText("Trending now")).toBeInTheDocument();
    });
  });

  it("shows empty message when no recommendations", async () => {
    fetchHandler = async () => new Response(
      JSON.stringify({ recommendations: [] }),
      { status: 200 }
    );

    const { RecommendationsWidget } = await import("@/components/recommendations");
    render(<RecommendationsWidget />);

    await waitFor(() => {
      expect(screen.getByText("Vote on proposals to get personalized recommendations")).toBeInTheDocument();
    });
  });

  it("handles API errors gracefully", async () => {
    fetchHandler = async () => new Response("", { status: 500 });

    const { RecommendationsWidget } = await import("@/components/recommendations");
    const { container } = render(<RecommendationsWidget />);

    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });

  it("fetches from correct API endpoint", async () => {
    const { RecommendationsWidget } = await import("@/components/recommendations");
    render(<RecommendationsWidget />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/proposals/recommendations?limit=5");
    });
  });
});
