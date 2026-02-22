CREATE TABLE IF NOT EXISTS `embeddings` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`vector` text NOT NULL,
	`model` text DEFAULT 'tfidf' NOT NULL,
	`dimensions` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_embeddings_entity` ON `embeddings` (`entity_type`, `entity_id`);
