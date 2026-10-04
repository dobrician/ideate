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

  it("searches with text retrieval without exposing algorithm choices", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Search..."), "test");
    await vi.advanceTimersByTimeAsync(350);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("mode=fts"), expect.objectContaining({ signal: expect.any(AbortSignal) })
    ));
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
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K");
  });

  it("omits diagnostic scores and response times from result presentation", async () => {
    fetchHandler = async () => new Response(JSON.stringify({
      results: [{ ...mockResults[0], score: 0.95, method: "semantic" }], responseTimeMs: 123,
    }), { status: 200 });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();
    await user.type(screen.getByLabelText("Search..."), "test");
    await vi.advanceTimersByTimeAsync(350);
    await waitFor(() => expect(screen.getByText("Project Alpha")).toBeInTheDocument());
    expect(screen.queryByText("95%")).not.toBeInTheDocument();
    expect(screen.queryByText("123ms")).not.toBeInTheDocument();
  });
});


describe("SearchBar adversarial regressions", () => {
  it("should clear stale options immediately when the query changes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();
    const input = screen.getByLabelText("Search...");
    await user.type(input, "alpha");
    await vi.advanceTimersByTimeAsync(350);
    await waitFor(() => expect(screen.getByText("Project Alpha")).toBeVisible());
    fetchHandler = () => new Promise<Response>(() => {});
    await user.type(input, " beta");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("should expose autocomplete and active selection on the focused input", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderSearchBar();
    await user.type(screen.getByLabelText("Search..."), "alpha");
    await vi.advanceTimersByTimeAsync(350);
    await waitFor(() => expect(screen.getAllByRole("option")[0]).toBeVisible());
    await user.keyboard("{ArrowDown}");
    const combobox = screen.getByRole("combobox");
    expect(combobox.tagName).toBe("INPUT");
    expect(combobox).toHaveFocus();
    expect(combobox).toHaveAttribute("aria-autocomplete", "list");
    expect(combobox).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[0].id);
  });
});
