-- Sprint 58: AI Lifecycle Management
-- Tables: ai_feedback, ai_models, ai_insights, notification_preferences

-- ─── AI Feedback ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,           -- 'routing' | 'conflicts' | 'deadlines' | 'predictions' | 'suggestions'
  entity_type TEXT NOT NULL,       -- 'proposal' | 'project'
  entity_id TEXT NOT NULL,
  rating INTEGER NOT NULL,         -- 1-5
  feedback_type TEXT NOT NULL DEFAULT 'rating',  -- 'rating' | 'thumbs' | 'correction'
  comment TEXT,
  ai_output TEXT,                  -- JSON: the AI output that was rated
  correction TEXT,                 -- user-provided correction
  model_version TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_ai_feedback_feature ON ai_feedback(feature);
CREATE INDEX idx_ai_feedback_user ON ai_feedback(user_id);
CREATE INDEX idx_ai_feedback_entity ON ai_feedback(entity_type, entity_id);
CREATE INDEX idx_ai_feedback_rating ON ai_feedback(feature, rating);

-- ─── AI Models ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  feature TEXT NOT NULL,
  version TEXT NOT NULL,
  provider TEXT NOT NULL,          -- 'gemini' | 'openai' | 'local'
  config TEXT,                     -- JSON: model-specific config
  accuracy REAL,                   -- 0-100
  total_predictions INTEGER NOT NULL DEFAULT 0,
  correct_predictions INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'inactive' | 'testing'
  deployed_at INTEGER DEFAULT (unixepoch()),
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_ai_models_feature ON ai_models(feature, status);

-- ─── AI Insights ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_insights (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,      -- 'trend' | 'bottleneck' | 'recommendation' | 'anomaly'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',  -- 'info' | 'warning' | 'critical'
  data TEXT,                       -- JSON: supporting data
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'dismissed' | 'resolved'
  dismissed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_ai_insights_project ON ai_insights(project_id, status);
CREATE INDEX idx_ai_insights_type ON ai_insights(insight_type, severity);

-- ─── Notification Channel Preferences (AI-powered) ──────────────────────
CREATE TABLE IF NOT EXISTS notification_channel_prefs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'in_app',  -- 'in_app' | 'email' | 'digest'
  category TEXT NOT NULL,          -- 'votes' | 'comments' | 'proposals' | 'ai_insights' | 'system'
  enabled INTEGER NOT NULL DEFAULT 1,
  digest_frequency TEXT,           -- 'daily' | 'weekly' | null
  smart_filter INTEGER NOT NULL DEFAULT 0,  -- AI-powered filtering
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(user_id, channel, category)
);

CREATE INDEX idx_notification_channel_prefs_user ON notification_channel_prefs(user_id);
