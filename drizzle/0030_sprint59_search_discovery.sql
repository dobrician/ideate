-- Sprint 59: Search & Discovery — Advanced Features & Integration
-- Tables: search_analytics, saved_searches, search_suggestions

-- Search analytics: track every search query
CREATE TABLE IF NOT EXISTS search_analytics (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'fts',
  filters TEXT, -- JSON of applied filters
  result_count INTEGER NOT NULL DEFAULT 0,
  response_time_ms INTEGER,
  clicked_result_id TEXT,
  clicked_result_type TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics(query);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_search_analytics_user ON search_analytics(user_id);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_search_analytics_created ON search_analytics(created_at);

--> statement-breakpoint

-- Saved searches: user-bookmarked search queries
CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'fts',
  filters TEXT, -- JSON of filters
  created_at INTEGER DEFAULT (unixepoch())
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);

--> statement-breakpoint

-- Search suggestions cache: popular/trending queries
CREATE TABLE IF NOT EXISTS search_suggestions (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL UNIQUE,
  frequency INTEGER NOT NULL DEFAULT 1,
  last_searched_at INTEGER DEFAULT (unixepoch()),
  avg_results INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_search_suggestions_freq ON search_suggestions(frequency DESC);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_search_suggestions_query ON search_suggestions(query);
