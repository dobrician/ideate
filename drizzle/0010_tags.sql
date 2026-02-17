CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);
--> statement-breakpoint
CREATE TABLE `project_tags` (
	`project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
	`tag_id` text NOT NULL REFERENCES `tags`(`id`) ON DELETE CASCADE,
	PRIMARY KEY(`project_id`, `tag_id`)
);
