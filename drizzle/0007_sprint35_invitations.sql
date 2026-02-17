-- Sprint 35: User invitation flow
CREATE TABLE IF NOT EXISTS `invitations` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `token` text NOT NULL,
  `invited_by` text REFERENCES `users`(`id`) ON DELETE SET NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `expires_at` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS `invitations_token_unique` ON `invitations` (`token`);
CREATE INDEX IF NOT EXISTS `idx_invitations_email` ON `invitations` (`email`);
CREATE INDEX IF NOT EXISTS `idx_invitations_status` ON `invitations` (`status`);
