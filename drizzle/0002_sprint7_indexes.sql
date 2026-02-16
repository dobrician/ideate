-- Sprint 7: Performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_proposals_project_id ON proposals(project_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_proposals_user_id ON proposals(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_votes_proposal_id ON votes(proposal_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_comments_proposal_id ON comments(proposal_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
