"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, FileText, Lightbulb } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchResult {
  id: string;
  title: string;
  type: "project" | "proposal";
  snippet: string;
}

/**
 * Global search bar with debounced full-text search.
 * Renders results in a dropdown overlay.
 */
export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
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

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search projects & proposals..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="pl-8 h-9"
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-80 overflow-y-auto">
          {loading && (
            <div className="p-3 text-sm text-muted-foreground">
              Searching...
            </div>
          )}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="p-3 text-sm text-muted-foreground">
              No results found
            </div>
          )}
          {results.map((result) => (
            <a
              key={`${result.type}-${result.id}`}
              href={
                result.type === "project"
                  ? `/projects/${result.id}`
                  : `/projects/${result.id}`
              }
              className="flex items-start gap-2 p-3 hover:bg-accent transition-colors border-b last:border-b-0"
              onClick={() => setIsOpen(false)}
            >
              {result.type === "project" ? (
                <FileText className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
              ) : (
                <Lightbulb className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {result.title}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {result.type}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
