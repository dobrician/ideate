-- Sprint 38: OIDC SSO — oauth_accounts table for linking external identity providers
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_provider_account
  ON oauth_accounts(provider, provider_account_id);

CREATE INDEX IF NOT EXISTS idx_oauth_user
  ON oauth_accounts(user_id);
