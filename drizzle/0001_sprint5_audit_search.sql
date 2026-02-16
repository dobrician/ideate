-- Sprint 5: Audit logs table
CREATE TABLE IF NOT EXISTS `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`details` text,
	`ip_address` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
-- Sprint 5: Full-text search virtual tables (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS projects_fts USING fts5(
	title,
	description,
	content='projects',
	content_rowid='rowid'
);
--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS proposals_fts USING fts5(
	title,
	description,
	content='proposals',
	content_rowid='rowid'
);
--> statement-breakpoint
-- Triggers to keep FTS tables in sync with source tables
CREATE TRIGGER IF NOT EXISTS projects_fts_insert AFTER INSERT ON projects BEGIN
	INSERT INTO projects_fts(rowid, title, description) VALUES (NEW.rowid, NEW.title, COALESCE(NEW.description, ''));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS projects_fts_update AFTER UPDATE ON projects BEGIN
	INSERT INTO projects_fts(projects_fts, rowid, title, description) VALUES ('delete', OLD.rowid, OLD.title, COALESCE(OLD.description, ''));
	INSERT INTO projects_fts(rowid, title, description) VALUES (NEW.rowid, NEW.title, COALESCE(NEW.description, ''));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS projects_fts_delete AFTER DELETE ON projects BEGIN
	INSERT INTO projects_fts(projects_fts, rowid, title, description) VALUES ('delete', OLD.rowid, OLD.title, COALESCE(OLD.description, ''));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS proposals_fts_insert AFTER INSERT ON proposals BEGIN
	INSERT INTO proposals_fts(rowid, title, description) VALUES (NEW.rowid, NEW.title, COALESCE(NEW.description, ''));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS proposals_fts_update AFTER UPDATE ON proposals BEGIN
	INSERT INTO proposals_fts(proposals_fts, rowid, title, description) VALUES ('delete', OLD.rowid, OLD.title, COALESCE(OLD.description, ''));
	INSERT INTO proposals_fts(rowid, title, description) VALUES (NEW.rowid, NEW.title, COALESCE(NEW.description, ''));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS proposals_fts_delete AFTER DELETE ON proposals BEGIN
	INSERT INTO proposals_fts(proposals_fts, rowid, title, description) VALUES ('delete', OLD.rowid, OLD.title, COALESCE(OLD.description, ''));
END;
