CREATE TABLE IF NOT EXISTS custom_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions TEXT NOT NULL DEFAULT '[]',
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_custom_roles_name ON custom_roles(name);
