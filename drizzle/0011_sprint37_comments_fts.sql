-- Sprint 37: Full-text search for comments
CREATE VIRTUAL TABLE IF NOT EXISTS comments_fts USING fts5(
	content_text,
	content='comments',
	content_rowid='rowid'
);
--> statement-breakpoint
-- Triggers to keep comments FTS in sync
CREATE TRIGGER IF NOT EXISTS comments_fts_insert AFTER INSERT ON comments BEGIN
	INSERT INTO comments_fts(rowid, content_text) VALUES (NEW.rowid, NEW.content);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS comments_fts_update AFTER UPDATE ON comments BEGIN
	INSERT INTO comments_fts(comments_fts, rowid, content_text) VALUES ('delete', OLD.rowid, OLD.content);
	INSERT INTO comments_fts(rowid, content_text) VALUES (NEW.rowid, NEW.content);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS comments_fts_delete AFTER DELETE ON comments BEGIN
	INSERT INTO comments_fts(comments_fts, rowid, content_text) VALUES ('delete', OLD.rowid, OLD.content);
END;
