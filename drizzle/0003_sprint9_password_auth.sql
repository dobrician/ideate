-- Sprint 9: Add email/password authentication columns to users table
ALTER TABLE users ADD COLUMN password_hash TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN verification_token TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN verification_token_expires INTEGER;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN reset_token TEXT;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN reset_token_expires INTEGER;
