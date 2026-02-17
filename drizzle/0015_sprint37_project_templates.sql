CREATE TABLE IF NOT EXISTS project_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  title_prefix TEXT,
  deadline_offset INTEGER,
  default_tags TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
