CREATE TABLE IF NOT EXISTS `notification_preferences` (
  `user_id` text PRIMARY KEY NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `email_new_proposal` integer NOT NULL DEFAULT 1,
  `email_vote_on_mine` integer NOT NULL DEFAULT 1,
  `email_comment_reply` integer NOT NULL DEFAULT 1,
  `updated_at` integer DEFAULT (unixepoch())
);
