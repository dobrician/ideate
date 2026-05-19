-- Sprint 71: Project share tokens — public read-only project links
ALTER TABLE projects ADD COLUMN share_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS projects_share_token_unique ON projects(share_token);
