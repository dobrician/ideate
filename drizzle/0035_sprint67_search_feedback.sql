-- Sprint 67: Search feedback table for quality tracking
CREATE TABLE IF NOT EXISTS "search_feedback" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "analytics_id" text REFERENCES "search_analytics"("id") ON DELETE CASCADE,
  "result_id" text NOT NULL,
  "result_type" text NOT NULL DEFAULT 'project',
  "rating" integer NOT NULL,
  "created_at" integer DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS "idx_search_feedback_analytics" ON "search_feedback"("analytics_id");
CREATE INDEX IF NOT EXISTS "idx_search_feedback_result" ON "search_feedback"("result_id", "result_type");
