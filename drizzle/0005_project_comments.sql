-- Sprint 16: Add project-level comments support
-- Allow comments on projects directly (not just proposals)

-- Make proposal_id nullable and add project_id
-- SQLite doesn't support ALTER COLUMN, so we recreate the table
CREATE TABLE comments_new (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text REFERENCES `proposals`(`id`) ON DELETE CASCADE,
	`project_id` text REFERENCES `projects`(`id`) ON DELETE CASCADE,
	`parent_id` text,
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
INSERT INTO comments_new (id, proposal_id, parent_id, content, created_at, updated_at, user_id)
	SELECT id, proposal_id, parent_id, content, created_at, updated_at, user_id FROM comments;
--> statement-breakpoint
DROP TABLE comments;
--> statement-breakpoint
ALTER TABLE comments_new RENAME TO comments;
--> statement-breakpoint
-- Recreate indexes that were on the old table
CREATE INDEX IF NOT EXISTS idx_comments_proposal_id ON comments(proposal_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
--> statement-breakpoint
-- New index for project-level comments
CREATE INDEX IF NOT EXISTS idx_comments_project_id ON comments(project_id);
