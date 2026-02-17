-- Sprint 37: LLM response cache table
CREATE TABLE IF NOT EXISTS `llm_cache` (
	`hash` text PRIMARY KEY NOT NULL,
	`prompt` text NOT NULL,
	`response` text NOT NULL,
	`model_used` text,
	`ttl` integer DEFAULT 86400 NOT NULL,
	`created_at` integer DEFAULT (unixepoch())
);
