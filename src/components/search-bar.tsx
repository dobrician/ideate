"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/use-locale";
import { sanitizeSnippet } from "@/lib/sanitize";

type EntityType = "project" | "proposal" | "comment";
interface SearchResult {
  id: string;
  title: string;
  type: EntityType;
  snippet: string;
  projectId?: string;
}

/** Search with one query, dependable text retrieval and keyboard navigation. */
export function SearchBar() {
  const { t } = useLocale();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setResults([]);
    setActiveIndex(-1);
    setOpen(false);
    setError(null);
    setLoading(query.trim().length >= 2);
    if (query.trim().length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ q: query.trim(), mode: "fts" });
        const response = await fetch(`/api/search?${params}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setResults([]);
          setError(response.status === 401 ? "search.errorUnauthorized" : "search.errorGeneric");
        } else {
          const data: { results?: SearchResult[] } = await response.json();
          if (controller.signal.aborted) return;
          setResults(data.results ?? []);
        }
        setActiveIndex(-1);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setError("search.errorGeneric");
          setOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", shortcut);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", shortcut);
    };
  }, []);

  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listId]);

  const href = (result: SearchResult) => `/projects/${result.type === "project" ? result.id : result.projectId || result.id}`;
  return (
    <div ref={containerRef} className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
      <Input ref={inputRef} type="search" role="combobox" aria-autocomplete="list"
        aria-expanded={open} aria-controls={open ? listId : undefined} aria-haspopup="listbox" value={query} placeholder={t("search.placeholder")}
        aria-label={t("search.placeholder")} aria-keyshortcuts="Control+K Meta+K"
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        className="pl-9" onChange={event => setQuery(event.target.value)}
        onFocus={() => { if (results.length || error) setOpen(true); }}
        onKeyDown={event => {
          if (event.key === "Escape") {
            if (open) { event.preventDefault(); event.stopPropagation(); setOpen(false); setActiveIndex(-1); }
            return;
          }
          if (!open) {
            if (event.key === "ArrowDown" && (results.length || error)) {
              event.preventDefault(); setOpen(true); setActiveIndex(results.length ? 0 : -1);
            }
            return;
          }
          if (!results.length) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex(previous => event.key === "ArrowDown"
              ? (previous + 1) % results.length
              : previous <= 0 ? results.length - 1 : previous - 1);
          } else if (event.key === "Enter" && activeIndex >= 0 && !loading) {
            event.preventDefault();
            window.location.href = href(results[activeIndex]);
          }
        }} />
      {loading && <p role="status" className="p-3 text-sm text-muted-foreground">{t("search.searching")}</p>}
      {open && <div className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border bg-popover shadow-md">
        {error && <p role="alert" className="p-3 text-sm text-destructive">{t(error)}</p>}
        {!error && !results.length && <p className="p-3 text-sm text-muted-foreground">{t("search.noResults")}</p>}
        <div id={listId} role="listbox" aria-label={t("search.ariaResults")}>
          {results.map((result, index) => <a key={`${result.type}-${result.id}`} id={`${listId}-${index}`}
            role="option" tabIndex={-1} aria-selected={index === activeIndex} href={href(result)}
            className={`block border-b p-3 last:border-b-0 hover:bg-accent ${index === activeIndex ? "bg-accent" : ""}`}
            onMouseEnter={() => setActiveIndex(index)} onClick={() => setOpen(false)}>
            <p className="break-words text-sm font-medium">{result.title}</p>
            <p className="text-xs text-muted-foreground">{t(`search.type${result.type === "project" ? "Project" : result.type === "proposal" ? "Proposal" : "Comment"}`)}</p>
            {result.snippet && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizeSnippet(result.snippet) }} />}
          </a>)}
        </div>
      </div>}
    </div>
  );
}
