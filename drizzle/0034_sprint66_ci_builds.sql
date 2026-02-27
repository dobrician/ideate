CREATE TABLE IF NOT EXISTS `ci_builds` (
  `id` text PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  `commit_hash` text NOT NULL,
  `branch` text NOT NULL DEFAULT 'main',
  `duration_ms` integer NOT NULL,
  `build_size_bytes` integer,
  `status` text NOT NULL DEFAULT 'success',
  `run_id` text,
  `created_at` integer DEFAULT (unixepoch())
);
