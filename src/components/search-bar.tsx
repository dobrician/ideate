"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, FileText, Lightbulb, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/use-locale";
import { sanitizeSnippet } from "@/lib/sanitize";

type SearchMode = "fts" | "semantic" | "hybrid";

interface SearchResult {
  id: string;
  title: string;
  type: "project" | "proposal" | "comment";
  snippet: string;
  projectId?: string;
}

export function SearchBar() {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mode, setMode] = useState<SearchMode>("fts");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string, searchMode: SearchMode) => {
    if (q.length < 2) {
      setResults([]);
      setError(null);
      setIsOpen(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, mode: searchMode });
      const res = await fetch(`/api/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setIsOpen(true);
        setActiveIndex(-1);
      } else if (res.status === 401) {
        setResults([]);
        setError(t("search.errorUnauthorized"));
        setIsOpen(true);
      } else {
        setResults([]);
        setError(t("search.errorGeneric"));
        setIsOpen(true);
      }
    } catch {
      setResults([]);
      setError(t("search.errorGeneric"));
      setIsOpen(true);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value, mode), 300);
  };

  const handleModeChange = (newMode: SearchMode) => {
    setMode(newMode);
    if (query.length >= 2) {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
      doSearch(query, newMode);
    }
  };

  const resultHref = (result: SearchResult) => {
    if (result.type === "project") return `/projects/${result.id}`;
    return `/projects/${result.projectId || result.id}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const selected = results[activeIndex];
      if (selected) {
        setIsOpen(false);
        window.location.href = resultHref(selected);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const grouped = {
    project: results.filter((r) => r.type === "project"),
    proposal: results.filter((r) => r.type === "proposal"),
    comment: results.filter((r) => r.type === "comment"),
  };

  const typeLabel = (type: SearchResult["type"]) => {
    switch (type) {
      case "project": return t("search.typeProject");
      case "proposal": return t("search.typeProposal");
      case "comment": return t("search.typeComment");
    }
  };

  const typeIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "project": return <FileText className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" aria-hidden="true" />;
      case "proposal": return <Lightbulb className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" aria-hidden="true" />;
      case "comment": return <MessageSquare className="h-4 w-4 mt-0.5 text-green-500 shrink-0" aria-hidden="true" />;
    }
  };

  const modeLabels: Record<SearchMode, string> = {
    fts: t("search.modeFts"),
    semantic: t("search.modeSemantic"),
    hybrid: t("search.modeHybrid"),
  };

  const hasResults = results.length > 0;
  const activeId = activeIndex >= 0 ? `search-result-${activeIndex}` : undefined;

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0) {
      document.getElementById(`search-result-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <div ref={containerRef} className="relative w-full max-w-sm" role="combobox" aria-expanded={isOpen} aria-controls="search-results-listbox" aria-haspopup="listbox">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          ref={inputRef}
          type="search"
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          aria-activedescendant={activeId}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => (results.length > 0 || error) && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-8 pr-24 h-9"
        />
        <div className="absolute right-2 top-1 flex items-center gap-1">
          <div
            className="flex h-7 rounded-md border bg-muted text-[10px] font-medium"
            role="radiogroup"
            aria-label={t("search.modeTooltip")}
          >
            {(["fts", "semantic", "hybrid"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => handleModeChange(m)}
                className={`px-1.5 rounded-md transition-colors ${
                  mode === m
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {modeLabels[m]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isOpen && (
        <div id="search-results-listbox" role="listbox" aria-label={t("search.ariaResults")} className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-80 overflow-y-auto animate-in fade-in-0 slide-in-from-top-1 duration-150">
          {loading && (
            <div className="p-3 text-sm text-muted-foreground" role="status" aria-live="polite">
              {t("search.searching")}
            </div>
          )}
          {!loading && error && (
            <div className="p-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}
          {!loading && !error && !hasResults && query.length >= 2 && (
            <div className="p-3 text-sm text-muted-foreground" role="status">
              {t("search.noResults")}
            </div>
          )}
          {!loading && !error && hasResults && (() => {
            let flatIndex = -1;
            return (["project", "proposal", "comment"] as const).map((type) => {
              const items = grouped[type];
              if (items.length === 0) return null;
              return (
                <div key={type}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                    {typeLabel(type)} ({items.length})
                  </div>
                  {items.map((result) => {
                    flatIndex++;
                    const idx = flatIndex;
                    const isActive = idx === activeIndex;
                    return (
                      <a
                        key={`${result.type}-${result.id}`}
                        id={`search-result-${idx}`}
                        role="option"
                        aria-selected={isActive}
                        href={resultHref(result)}
                        className={`flex items-start gap-2 p-3 transition-colors duration-150 border-b last:border-b-0 focus:outline-none ${isActive ? "bg-accent" : "hover:bg-accent"}`}
                        onClick={() => setIsOpen(false)}
                        onMouseEnter={() => setActiveIndex(idx)}
                      >
                        {typeIcon(result.type)}
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{result.title}</div>
                          {result.snippet && (
                            <div className="text-xs text-muted-foreground line-clamp-2" dangerouslySetInnerHTML={{ __html: sanitizeSnippet(result.snippet) }} />
                          )}
                        </div>
                      </a>
                    );
                  })}
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}
