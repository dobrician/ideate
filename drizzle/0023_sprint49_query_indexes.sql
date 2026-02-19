CREATE INDEX IF NOT EXISTS idx_projects_deadline ON projects(deadline);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_comments_proposal_created ON comments(proposal_id, created_at);
