// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

vi.mock("@/lib/use-locale", () => ({
  useLocale: () => ({
    locale: "en",
    t: (key: string) => {
      const map: Record<string, string> = {
        "search.placeholder": "Search...",
        "search.ariaResults": "Search results",
        "search.searching": "Searching...",
        "search.noResults": "No results found",
        "search.typeProject": "Projects",
        "search.typeProposal": "Proposals",
        "search.typeComment": "Comments",
        "search.errorUnauthorized": "Please sign in to search",
        "search.errorGeneric": "Search failed. Please try again.",
        "search.modeFts": "Keyword",
        "search.modeSemantic": "Semantic",
        "search.modeHybrid": "Smart",
        "search.modeTooltip": "Search mode",
        "search.modeFtsDesc": "Exact keyword matching",
        "search.modeSemanticDesc": "AI-powered meaning search",
        "search.modeHybridDesc": "Combined keyword + AI",
        "search.similarityScore": "Relevance",
        "search.responseTime": "{ms}ms",
        "search.methodFts": "keyword",
        "search.methodSemantic": "AI",
        "search.methodHybrid": "hybrid",
      };
      return map[key] ?? key;
    },
  }),
}));

const mockResults = [
  { id: "p1", title: "Project Alpha", type: "project", snippet: "A project" },
  { id: "p2", title: "Cool Proposal", type: "proposal", snippet: "A proposal", projectId: "p1" },
];

let fetchHandler: (url: string) => Promise<Response>;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchHandler = async () => new Response(JSON.stringify({ results: mockResults }), { status: 200 });
  global.fetch = vi.fn((url: string | URL | Request) =>
    fetchHandler(typeof url === "string" ? url : String(url))
  );
  // JSDOM does not implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function renderSearchBar() {
  const { SearchBar } = await import("@/components/search-bar");
  return render(<SearchBar />);
}

describe("SearchBar keyboard navigation", () => {
  it("renders with combobox role and search input", async () => {
    await renderSearchBar();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByLabelText("Search...")).toBeInTheDocument();
  });

  it("opens results on typing >= 2 chars", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();

    const input = screen.getByLabelText("Search...");
    await user.type(input, "te");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
  });

  it("navigates with ArrowDown and ArrowUp", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();

    const input = screen.getByLabelText("Search...");
    await user.type(input, "test");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    await user.keyboard("{ArrowDown}");
    const first = screen.getByText("Project Alpha").closest("[role=option]");
    expect(first).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    const second = screen.getByText("Cool Proposal").closest("[role=option]");
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(first).toHaveAttribute("aria-selected", "false");

    await user.keyboard("{ArrowUp}");
    expect(first).toHaveAttribute("aria-selected", "true");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();

    const input = screen.getByLabelText("Search...");
    await user.type(input, "test");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not show results for single char", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();

    const input = screen.getByLabelText("Search...");
    await user.type(input, "t");
    await vi.advanceTimersByTimeAsync(350);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows no results message for empty response", async () => {
    fetchHandler = async () => new Response(JSON.stringify({ results: [] }), { status: 200 });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();

    const input = screen.getByLabelText("Search...");
    await user.type(input, "nonexistent");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(screen.getByText("No results found")).toBeInTheDocument();
    });
  });

  it("shows unauthorized error on 401 response", async () => {
    fetchHandler = async () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();

    const input = screen.getByLabelText("Search...");
    await user.type(input, "test");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(screen.getByText("Please sign in to search")).toBeInTheDocument();
    });
  });

  it("shows generic error on 500 response", async () => {
    fetchHandler = async () => new Response(JSON.stringify({ error: "Internal" }), { status: 500 });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();

    const input = screen.getByLabelText("Search...");
    await user.type(input, "test");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(screen.getByText("Search failed. Please try again.")).toBeInTheDocument();
    });
  });

  it("shows generic error on network failure", async () => {
    fetchHandler = async () => { throw new Error("Network error"); };
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();

    const input = screen.getByLabelText("Search...");
    await user.type(input, "test");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(screen.getByText("Search failed. Please try again.")).toBeInTheDocument();
    });
  });

  it("clears error when new search succeeds", async () => {
    fetchHandler = async () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();

    const input = screen.getByLabelText("Search...");
    await user.type(input, "test");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(screen.getByText("Please sign in to search")).toBeInTheDocument();
    });

    // Now make search succeed
    fetchHandler = async () => new Response(JSON.stringify({ results: mockResults }), { status: 200 });
    await user.clear(input);
    await user.type(input, "alpha");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(screen.queryByText("Please sign in to search")).not.toBeInTheDocument();
      expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    });
  });

  it("renders search mode toggle buttons", async () => {
    await renderSearchBar();
    expect(screen.getByRole("radiogroup", { name: "Search mode" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Keyword/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Semantic/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Smart/i })).toBeInTheDocument();
  });

  it("passes mode parameter when searching", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();

    // Click Semantic mode
    await user.click(screen.getByRole("radio", { name: /Semantic/i }));

    const input = screen.getByLabelText("Search...");
    await user.type(input, "test");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const lastCall = calls[calls.length - 1][0] as string;
      expect(lastCall).toContain("mode=semantic");
    });
  });

  it("wraps ArrowDown from last to first item", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();

    const input = screen.getByLabelText("Search...");
    await user.type(input, "test");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    // Navigate to last item and then one more
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}"); // wraps to first

    const first = screen.getByText("Project Alpha").closest("[role=option]");
    expect(first).toHaveAttribute("aria-selected", "true");
  });

  it("has aria-keyshortcuts on the search input", async () => {
    const { SearchBar } = await import("@/components/search-bar");
    render(<SearchBar />);
    const input = screen.getByRole("searchbox");
    expect(input).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K");
  });

  it("mode toggle buttons have title tooltips", async () => {
    await renderSearchBar();
    const ftsBtn = screen.getByRole("radio", { name: /^Keyword/i });
    const semanticBtn = screen.getByRole("radio", { name: /Semantic/i });
    const smartBtn = screen.getByRole("radio", { name: /Smart/i });
    expect(ftsBtn).toHaveAttribute("title", "Keyword — Exact keyword matching");
    expect(semanticBtn).toHaveAttribute("title", "Semantic — AI-powered meaning search");
    expect(smartBtn).toHaveAttribute("title", "Smart — Combined keyword + AI");
  });

  it("displays response time when returned by API", async () => {
    fetchHandler = async (url: string) => {
      if (url.includes("/api/search/suggestions")) {
        return new Response(JSON.stringify({ suggestions: [] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ results: mockResults, responseTimeMs: 42 }),
        { status: 200 }
      );
    };
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();

    const input = screen.getByLabelText("Search...");
    await user.type(input, "test");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(screen.getByText("42ms")).toBeInTheDocument();
    });
  });

  it("displays result count header", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();

    const input = screen.getByLabelText("Search...");
    await user.type(input, "test");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(screen.getByText("2 results")).toBeInTheDocument();
    });
  });

  it("shows similarity score badges in semantic mode", async () => {
    const semanticResults = [
      { id: "p1", title: "Project Alpha", type: "project", snippet: "A project", score: 0.87, method: "semantic" },
      { id: "p2", title: "Cool Proposal", type: "proposal", snippet: "A proposal", projectId: "p1", score: 0.65, method: "semantic" },
    ];
    fetchHandler = async (url: string) => {
      if (url.includes("/api/search/suggestions")) {
        return new Response(JSON.stringify({ suggestions: [] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ results: semanticResults, responseTimeMs: 15 }),
        { status: 200 }
      );
    };
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();

    // Switch to Semantic mode first
    await user.click(screen.getByRole("radio", { name: /Semantic/i }));

    const input = screen.getByLabelText("Search...");
    await user.type(input, "test query");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(screen.getByText("87%")).toBeInTheDocument();
      expect(screen.getByText("65%")).toBeInTheDocument();
    });
  });

  it("shows method labels in semantic/hybrid mode", async () => {
    const semanticResults = [
      { id: "p1", title: "Project Alpha", type: "project", snippet: "A project", score: 0.9, method: "semantic" },
    ];
    fetchHandler = async (url: string) => {
      if (url.includes("/api/search/suggestions")) {
        return new Response(JSON.stringify({ suggestions: [] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ results: semanticResults, responseTimeMs: 10 }),
        { status: 200 }
      );
    };
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();

    await user.click(screen.getByRole("radio", { name: /Semantic/i }));
    const input = screen.getByLabelText("Search...");
    await user.type(input, "test");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(screen.getByText("AI")).toBeInTheDocument();
    });
  });

  it("does not show scores in FTS mode", async () => {
    const ftsResults = [
      { id: "p1", title: "Project Alpha", type: "project", snippet: "A project", score: 0.87, method: "fts" },
    ];
    fetchHandler = async (url: string) => {
      if (url.includes("/api/search/suggestions")) {
        return new Response(JSON.stringify({ suggestions: [] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ results: ftsResults, responseTimeMs: 5 }),
        { status: 200 }
      );
    };
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();

    const input = screen.getByLabelText("Search...");
    await user.type(input, "test");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    });
    // Score badge should NOT appear in FTS mode
    expect(screen.queryByText("87%")).not.toBeInTheDocument();
  });
});
