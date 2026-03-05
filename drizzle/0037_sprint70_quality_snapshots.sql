-- Sprint 70: Embedding quality snapshots for trend tracking
CREATE TABLE IF NOT EXISTS embedding_quality_snapshots (
  id TEXT PRIMARY KEY,
  overall_score INTEGER NOT NULL,
  self_similarity REAL NOT NULL,
  cross_similarity REAL NOT NULL,
  separation REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  grade TEXT NOT NULL DEFAULT 'poor',
  by_model TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_eq_snapshots_created ON embedding_quality_snapshots(created_at);
