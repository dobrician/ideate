-- Sprint 70: CI regression alerts — persisted alert history
CREATE TABLE IF NOT EXISTS ci_regression_alerts (
  id TEXT PRIMARY KEY,
  alert_type TEXT NOT NULL DEFAULT 'regression',
  severity TEXT NOT NULL DEFAULT 'warning',
  message TEXT NOT NULL,
  branch TEXT,
  avg_recent_ms INTEGER,
  avg_baseline_ms INTEGER,
  regression_pct REAL,
  failure_count INTEGER,
  threshold INTEGER NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_ci_alerts_created ON ci_regression_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_ci_alerts_resolved ON ci_regression_alerts(resolved);
