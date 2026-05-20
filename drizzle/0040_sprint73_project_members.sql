-- Sprint 73: Project membership via share-link visit.
-- Logged-in users who visit /p/<token> are auto-INSERTed here as project members,
-- gaining write access (proposal:create / vote:cast / comment:create) for THIS project
-- regardless of their global role (e.g. viewer can now contribute on shared projects).
CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_via TEXT NOT NULL DEFAULT 'share_link',
  joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS project_members_user_idx ON project_members(user_id);
