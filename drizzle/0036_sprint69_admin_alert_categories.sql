-- Sprint 69: Extend notification_channel_prefs category enum
-- Adds admin alert categories: ci_alerts, search_quality, embedding_alerts, system_events
-- SQLite text columns have no runtime enum constraint — this migration is a no-op.
-- The enum extension is enforced at the TypeScript/Drizzle schema level only.
SELECT 1;
