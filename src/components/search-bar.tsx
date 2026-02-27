"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, FileText, Lightbulb, MessageSquare, Filter, TrendingUp, Tag, Sparkles, Clock, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/use-locale";
import { sanitizeSnippet } from "@/lib/sanitize";

type SearchMode = "fts" | "semantic" | "hybrid";
type EntityType = "project" | "proposal" | "comment";

interface SearchResult {
  id: string;
  title: string;
  type: EntityType;
  snippet: string;
  projectId?: string;
  authorName?: string;
  voteCount?: number;
  score?: number;
  method?: "fts" | "semantic" | "hybrid";
}

interface Suggestion {
  text: string;
  type: "popular" | "entity" | "tag" | "correction";
  entityType?: string;
  frequency?: number;
}

export function SearchBar() {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mode, setMode] = useState<SearchMode>("fts");
  const [analyticsId, setAnalyticsId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [entityFilter, setEntityFilter] = useState<EntityType[]>([]);
  const [correction, setCorrection] = useState<string | null>(null);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string, searchMode: SearchMode, types: EntityType[]) => {
    if (q.length < 2) {
      setResults([]);
      setError(null);
      setCorrection(null);
      return;
    }
    setLoading(true);
    setError(null);
    setCorrection(null);
    setSuggestions([]);
    setResponseTimeMs(null);
    try {
      const params = new URLSearchParams({ q, mode: searchMode });
      if (types.length > 0) {
        params.set("entityTypes", types.join(","));
      }
      const res = await fetch(`/api/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setAnalyticsId(data.analyticsId || null);
        setResponseTimeMs(data.responseTimeMs ?? null);
        setIsOpen(true);
        setActiveIndex(-1);

        // If no results, fetch suggestions for "did you mean"
        if ((data.results || []).length === 0) {
          fetchCorrection(q);
        }
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

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 1) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        if (data.suggestions?.length > 0 && results.length === 0) {
          setIsOpen(true);
        }
      }
    } catch { /* ignore */ }
  }, [results.length]);

  const fetchCorrection = async (q: string) => {
    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        const corr = (data.suggestions || []).find((s: Suggestion) => s.type === "correction");
        if (corr) setCorrection(corr.text);
      }
    } catch { /* ignore */ }
  };

  const trackClick = (resultId: string, resultType: EntityType) => {
    if (!analyticsId) return;
    fetch("/api/search/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analyticsId, resultId, resultType }),
    }).catch(() => {});
  };

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    if (suggestRef.current !== null) clearTimeout(suggestRef.current);

    // Suggestions: faster, lower threshold
    suggestRef.current = setTimeout(() => fetchSuggestions(value), 150);
    // Search: standard debounce
    debounceRef.current = setTimeout(() => doSearch(value, mode, entityFilter), 300);
  };

  const handleModeChange = (newMode: SearchMode) => {
    setMode(newMode);
    if (query.length >= 2) {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
      doSearch(query, newMode, entityFilter);
    }
  };

  const handleEntityToggle = (type: EntityType) => {
    const newFilter = entityFilter.includes(type)
      ? entityFilter.filter((t) => t !== type)
      : [...entityFilter, type];
    setEntityFilter(newFilter);
    if (query.length >= 2) {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
      doSearch(query, mode, newFilter);
    }
  };

  const handleSuggestionClick = (text: string) => {
    setQuery(text);
    setSuggestions([]);
    doSearch(text, mode, entityFilter);
  };

  const handleCorrectionClick = () => {
    if (correction) {
      setQuery(correction);
      setCorrection(null);
      doSearch(correction, mode, entityFilter);
    }
  };

  const resultHref = (result: SearchResult) => {
    if (result.type === "project") return `/projects/${result.id}`;
    return `/projects/${result.projectId || result.id}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    // If showing suggestions only
    if (results.length === 0 && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      } else if (e.key === "Enter" && activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        handleSuggestionClick(suggestions[activeIndex].text);
      } else if (e.key === "Escape") {
        setIsOpen(false);
        setActiveIndex(-1);
      }
      return;
    }

    if (results.length === 0) return;
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
        trackClick(selected.id, selected.type);
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

  const typeLabel = (type: EntityType) => {
    switch (type) {
      case "project": return t("search.typeProject");
      case "proposal": return t("search.typeProposal");
      case "comment": return t("search.typeComment");
    }
  };

  const typeIcon = (type: EntityType) => {
    switch (type) {
      case "project": return <FileText className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" aria-hidden="true" />;
      case "proposal": return <Lightbulb className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" aria-hidden="true" />;
      case "comment": return <MessageSquare className="h-4 w-4 mt-0.5 text-green-500 shrink-0" aria-hidden="true" />;
    }
  };

  const suggestionIcon = (type: Suggestion["type"]) => {
    switch (type) {
      case "popular": return <TrendingUp className="h-3.5 w-3.5 text-blue-500 shrink-0" aria-hidden="true" />;
      case "entity": return <FileText className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-hidden="true" />;
      case "tag": return <Tag className="h-3.5 w-3.5 text-green-500 shrink-0" aria-hidden="true" />;
      case "correction": return <Sparkles className="h-3.5 w-3.5 text-purple-500 shrink-0" aria-hidden="true" />;
    }
  };

  const modeLabels: Record<SearchMode, string> = {
    fts: t("search.modeFts"),
    semantic: t("search.modeSemantic"),
    hybrid: t("search.modeHybrid"),
  };

  const modeDescs: Record<SearchMode, string> = {
    fts: t("search.modeFtsDesc"),
    semantic: t("search.modeSemanticDesc"),
    hybrid: t("search.modeHybridDesc"),
  };

  const methodLabel = (method?: string) => {
    switch (method) {
      case "fts": return t("search.methodFts");
      case "semantic": return t("search.methodSemantic");
      case "hybrid": return t("search.methodHybrid");
      default: return null;
    }
  };

  const formatScore = (score?: number) => {
    if (score === undefined || score === null) return null;
    return Math.round(score * 100);
  };

  const hasResults = results.length > 0;
  const hasSuggestions = suggestions.length > 0;
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
          aria-keyshortcuts="Control+K Meta+K"
          aria-activedescendant={activeId}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0 || error || suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="pl-8 pr-32 h-9"
        />
        <div className="absolute right-2 top-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
              showFilters || entityFilter.length > 0
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            aria-label={showFilters ? t("search.hideFilters") : t("search.showFilters")}
            aria-pressed={showFilters}
          >
            <Filter className="h-3.5 w-3.5" />
          </button>
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
                title={modeDescs[m]}
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

      {/* Entity type filters */}
      {showFilters && (
        <div className="flex items-center gap-1.5 mt-1.5 px-0.5" role="group" aria-label={t("search.filterByType")}>
          {(["project", "proposal", "comment"] as const).map((type) => {
            const active = entityFilter.includes(type);
            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                onClick={() => handleEntityToggle(type)}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-transparent hover:border-border"
                }`}
              >
                {typeIcon(type)}
                <span>{typeLabel(type)}</span>
              </button>
            );
          })}
          {entityFilter.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setEntityFilter([]);
                if (query.length >= 2) doSearch(query, mode, []);
              }}
              className="text-xs text-muted-foreground hover:text-foreground px-1.5"
            >
              {t("search.clearFilters")}
            </button>
          )}
        </div>
      )}

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

          {/* Suggestions (shown when no results yet) */}
          {!loading && !error && !hasResults && hasSuggestions && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                {t("search.suggestions")}
              </div>
              {suggestions.map((s, i) => {
                const isActive = i === activeIndex;
                return (
                  <button
                    key={`suggestion-${i}`}
                    id={`search-result-${i}`}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSuggestionClick(s.text)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex items-center gap-2 w-full text-left p-3 text-sm transition-colors border-b last:border-b-0 ${
                      isActive ? "bg-accent" : "hover:bg-accent"
                    }`}
                  >
                    {suggestionIcon(s.type)}
                    <span className="truncate">{s.text}</span>
                    {s.type === "correction" && (
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {t("search.didYouMean")}
                      </span>
                    )}
                    {s.frequency && s.frequency > 1 && (
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {s.frequency}x
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* "Did you mean" correction for zero results */}
          {!loading && !error && !hasResults && !hasSuggestions && query.length >= 2 && correction && (
            <div className="p-3">
              <div className="text-sm text-muted-foreground">{t("search.noResults")}</div>
              <button
                type="button"
                onClick={handleCorrectionClick}
                className="mt-1 text-sm text-primary hover:underline"
              >
                {t("search.didYouMean")}: <span className="font-medium">{correction}</span>
              </button>
            </div>
          )}

          {/* No results, no suggestions */}
          {!loading && !error && !hasResults && !hasSuggestions && !correction && query.length >= 2 && (
            <div className="p-3 text-sm text-muted-foreground" role="status">
              {t("search.noResults")}
            </div>
          )}

          {/* Search results */}
          {!loading && !error && hasResults && (() => {
            let flatIndex = -1;
            return (
              <>
                {/* Response time + result count header */}
                <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b bg-muted/30">
                  <span>{results.length} {results.length === 1 ? "result" : "results"}</span>
                  <div className="flex items-center gap-2">
                    {mode !== "fts" && (
                      <span className="flex items-center gap-0.5">
                        <Zap className="h-3 w-3" aria-hidden="true" />
                        {modeLabels[mode]}
                      </span>
                    )}
                    {responseTimeMs !== null && (
                      <span className="flex items-center gap-0.5" aria-label={t("search.responseTime").replace("{ms}", String(responseTimeMs))}>
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {responseTimeMs}ms
                      </span>
                    )}
                  </div>
                </div>
                {(["project", "proposal", "comment"] as const).map((type) => {
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
                        const scorePercent = formatScore(result.score);
                        const method = methodLabel(result.method);
                        return (
                          <a
                            key={`${result.type}-${result.id}`}
                            id={`search-result-${idx}`}
                            role="option"
                            aria-selected={isActive}
                            href={resultHref(result)}
                            className={`flex items-start gap-2 p-3 transition-colors duration-150 border-b last:border-b-0 focus:outline-none ${isActive ? "bg-accent" : "hover:bg-accent"}`}
                            onClick={() => {
                              trackClick(result.id, result.type);
                              setIsOpen(false);
                            }}
                            onMouseEnter={() => setActiveIndex(idx)}
                          >
                            {typeIcon(result.type)}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium truncate">{result.title}</span>
                                {scorePercent !== null && mode !== "fts" && (
                                  <span
                                    className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary"
                                    title={`${t("search.similarityScore")}: ${scorePercent}%`}
                                  >
                                    {scorePercent}%
                                  </span>
                                )}
                                {method && mode !== "fts" && (
                                  <span className="shrink-0 text-[10px] text-muted-foreground">
                                    {method}
                                  </span>
                                )}
                              </div>
                              {result.snippet && (
                                <div className="text-xs text-muted-foreground line-clamp-2" dangerouslySetInnerHTML={{ __html: sanitizeSnippet(result.snippet) }} />
                              )}
                              {(result.authorName || result.voteCount !== undefined) && (
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                  {result.authorName && <span>{result.authorName}</span>}
                                  {result.voteCount !== undefined && <span>{result.voteCount > 0 ? "+" : ""}{result.voteCount} votes</span>}
                                </div>
                              )}
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
