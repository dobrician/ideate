-- Sprint 36: File attachments on proposals
CREATE TABLE IF NOT EXISTS `attachments` (
  `id` text PRIMARY KEY NOT NULL,
  `proposal_id` text NOT NULL REFERENCES `proposals`(`id`) ON DELETE CASCADE,
  `filename` text NOT NULL,
  `mime_type` text NOT NULL,
  `size` integer NOT NULL,
  `storage_path` text NOT NULL,
  `user_id` text REFERENCES `users`(`id`) ON DELETE SET NULL,
  `created_at` integer DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS `idx_attachments_proposal_id` ON `attachments` (`proposal_id`);
CREATE INDEX IF NOT EXISTS `idx_attachments_user_id` ON `attachments` (`user_id`);
