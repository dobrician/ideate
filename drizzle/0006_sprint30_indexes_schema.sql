-- Sprint 30: DB indexes & schema fixes
-- Add missing index on comments.parent_id for threading queries
-- Add foreign key on comments.parent_id (self-referencing)
-- Add updated_at to votes table

-- 1. Index on comments.parent_id
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
--> statement-breakpoint

-- 2. Recreate comments table with FK on parent_id
CREATE TABLE IF NOT EXISTS comments_new (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text REFERENCES `proposals`(`id`) ON DELETE CASCADE,
	`project_id` text REFERENCES `projects`(`id`) ON DELETE CASCADE,
	`parent_id` text REFERENCES `comments_new`(`id`) ON DELETE CASCADE,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	`user_id` text REFERENCES `users`(`id`) ON DELETE SET NULL,
	CHECK (
		(`proposal_id` IS NOT NULL AND `project_id` IS NULL)
		OR (`proposal_id` IS NULL AND `project_id` IS NOT NULL)
	)
);
--> statement-breakpoint
INSERT OR IGNORE INTO comments_new (id, proposal_id, project_id, parent_id, content, created_at, updated_at, user_id)
	SELECT id, proposal_id, project_id, parent_id, content, created_at, updated_at, user_id
	FROM comments;
--> statement-breakpoint
DROP TABLE IF EXISTS comments;
--> statement-breakpoint
ALTER TABLE comments_new RENAME TO comments;
--> statement-breakpoint
-- Recreate all comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_proposal_id ON comments(proposal_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_comments_project_id ON comments(project_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
--> statement-breakpoint

-- 3. Add updated_at to votes table (SQLite requires constant default for ALTER TABLE ADD COLUMN)
ALTER TABLE votes ADD COLUMN `updated_at` integer DEFAULT 0;
--> statement-breakpoint
UPDATE votes SET updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE updated_at = 0;
