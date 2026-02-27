-- Sprint 54: Analytics performance indexes for vote velocity, social, momentum, and predictions
CREATE INDEX IF NOT EXISTS idx_votes_proposal_created ON votes(proposal_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_votes_user_created ON votes(user_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_comments_user_created ON comments(user_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_proposals_user ON proposals(user_id);
