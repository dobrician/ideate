"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, FileText, Lightbulb, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/use-locale";

interface SearchResult {
  id: string;
  title: string;
  type: "project" | "proposal" | "comment";
  snippet: string;
  projectId?: string;
}

/**
 * Global search bar with debounced full-text search.
 * Renders results in a dropdown overlay grouped by type.
 * Opens with Cmd/Ctrl+K keyboard shortcut.
 */
export function SearchBar() {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setIsOpen(true);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cmd/Ctrl+K to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Group results by type
  const grouped = {
    project: results.filter((r) => r.type === "project"),
    proposal: results.filter((r) => r.type === "proposal"),
    comment: results.filter((r) => r.type === "comment"),
  };

  const typeLabel = (type: SearchResult["type"]) => {
    switch (type) {
      case "project":
        return t("search.typeProject");
      case "proposal":
        return t("search.typeProposal");
      case "comment":
        return t("search.typeComment");
    }
  };

  const typeIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "project":
        return <FileText className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" aria-hidden="true" />;
      case "proposal":
        return <Lightbulb className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" aria-hidden="true" />;
      case "comment":
        return <MessageSquare className="h-4 w-4 mt-0.5 text-green-500 shrink-0" aria-hidden="true" />;
    }
  };

  const resultHref = (result: SearchResult) => {
    if (result.type === "project") return `/projects/${result.id}`;
    return `/projects/${result.projectId || result.id}`;
  };

  const hasResults = results.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-sm" role="combobox" aria-expanded={isOpen} aria-controls="search-results-listbox" aria-haspopup="listbox">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          ref={inputRef}
          type="search"
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="pl-8 h-9"
        />
        <kbd className="pointer-events-none absolute right-2 top-1.5 hidden h-6 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-60 sm:flex" aria-hidden="true">
          <span className="text-xs">{typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent) ? "\u2318" : "Ctrl"}</span>K
        </kbd>
      </div>

      {isOpen && (
        <div id="search-results-listbox" role="listbox" aria-label={t("search.ariaResults")} className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-80 overflow-y-auto animate-in fade-in-0 slide-in-from-top-1 duration-150">
          {loading && (
            <div className="p-3 text-sm text-muted-foreground" role="status" aria-live="polite">
              {t("search.searching")}
            </div>
          )}
          {!loading && !hasResults && query.length >= 2 && (
            <div className="p-3 text-sm text-muted-foreground" role="status">
              {t("search.noResults")}
            </div>
          )}
          {!loading && hasResults && (
            <>
              {(["project", "proposal", "comment"] as const).map((type) => {
                const items = grouped[type];
                if (items.length === 0) return null;
                return (
                  <div key={type}>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                      {typeLabel(type)} ({items.length})
                    </div>
                    {items.map((result) => (
                      <a
                        key={`${result.type}-${result.id}`}
                        role="option"
                        aria-selected={false}
                        href={resultHref(result)}
                        className="flex items-start gap-2 p-3 hover:bg-accent transition-colors duration-150 border-b last:border-b-0 focus:bg-accent focus:outline-none"
                        onClick={() => setIsOpen(false)}
                      >
                        {typeIcon(result.type)}
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {result.title}
                          </div>
                          {result.snippet && (
                            <div
                              className="text-xs text-muted-foreground line-clamp-2"
                              dangerouslySetInnerHTML={{ __html: result.snippet }}
                            />
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
