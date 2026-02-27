-- Sprint 55: Workflow engine tables
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  stages TEXT NOT NULL DEFAULT '[]',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS workflow_stages (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  stage_order INTEGER NOT NULL DEFAULT 0,
  allowed_roles TEXT NOT NULL DEFAULT '[]',
  auto_advance INTEGER NOT NULL DEFAULT 0,
  auto_advance_after INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS proposal_workflow_state (
  proposal_id TEXT PRIMARY KEY REFERENCES proposals(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  current_stage_id TEXT NOT NULL REFERENCES workflow_stages(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'rejected')),
  entered_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS approval_records (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL REFERENCES workflow_stages(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN ('approve', 'reject', 'comment')),
  comment TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_workflow_stages_workflow ON workflow_stages(workflow_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_proposal_workflow_state_workflow ON proposal_workflow_state(workflow_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_approval_records_proposal ON approval_records(proposal_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_approval_records_stage ON approval_records(stage_id);
