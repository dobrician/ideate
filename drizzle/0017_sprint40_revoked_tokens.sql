CREATE TABLE IF NOT EXISTS `revoked_tokens` (
	`jti` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer DEFAULT (unixepoch())
);
