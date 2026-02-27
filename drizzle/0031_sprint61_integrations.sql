-- Sprint 61: Integration & API Excellence
-- Adds webhook enhancements, API keys, and platform integrations

-- Enhance webhooks table with retry config, payload templates, description
ALTER TABLE webhooks ADD COLUMN retry_config TEXT;
ALTER TABLE webhooks ADD COLUMN payload_template TEXT;
ALTER TABLE webhooks ADD COLUMN description TEXT;

-- API Keys table for external API access
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scopes TEXT NOT NULL DEFAULT '[]',
  tier TEXT NOT NULL DEFAULT 'basic' CHECK(tier IN ('basic', 'pro', 'enterprise')),
  rate_limit INTEGER NOT NULL DEFAULT 100,
  rate_limit_window INTEGER NOT NULL DEFAULT 3600,
  last_used_at INTEGER,
  expires_at INTEGER,
  revoked INTEGER NOT NULL DEFAULT 0,
  total_requests INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- Platform integrations table (Slack, Teams, Discord)
CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK(platform IN ('slack', 'teams', 'discord')),
  name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  config TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_integrations_platform ON integrations(platform);
