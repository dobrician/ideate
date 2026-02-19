CREATE TABLE IF NOT EXISTS cache_entries (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  ttl INTEGER NOT NULL DEFAULT 300,
  created_at INTEGER DEFAULT (unixepoch())
);
