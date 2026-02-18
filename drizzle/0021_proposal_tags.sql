CREATE TABLE IF NOT EXISTS proposal_tags (
  proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (proposal_id, tag_id)
);
