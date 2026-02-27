-- Sprint 56: Advanced Permissions — Time-based & Dynamic Permission Controls
-- Tables: permission_rules, resource_acls

-- ─── Permission Rules (time-based, conditional) ──────────────────────────
CREATE TABLE IF NOT EXISTS permission_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL CHECK(rule_type IN ('time_expiry', 'schedule', 'deadline', 'condition')),
  -- Target: who the rule applies to (specific user, role, or all)
  target_type TEXT NOT NULL CHECK(target_type IN ('user', 'role', 'all')),
  target_id TEXT, -- user ID or role name (NULL if target_type='all')
  -- Permission being governed
  permission TEXT NOT NULL,
  -- Effect: grant or deny
  effect TEXT NOT NULL CHECK(effect IN ('grant', 'deny')) DEFAULT 'grant',
  -- Time constraints (ISO 8601 timestamps stored as epoch seconds)
  starts_at INTEGER, -- NULL = immediate
  expires_at INTEGER, -- NULL = no expiry
  -- Schedule (JSON: { "days": [0-6], "startHour": 0-23, "endHour": 0-23, "timezone": "UTC" })
  schedule TEXT,
  -- Condition (JSON: { "type": "vote_count", "operator": ">=", "value": 10, "entity": "proposal" })
  condition TEXT,
  -- Scope: optional entity restriction
  entity_type TEXT CHECK(entity_type IN ('project', 'proposal') OR entity_type IS NULL),
  entity_id TEXT,
  -- Status
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_permission_rules_target ON permission_rules(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_permission_rules_permission ON permission_rules(permission);
CREATE INDEX IF NOT EXISTS idx_permission_rules_active ON permission_rules(active);
CREATE INDEX IF NOT EXISTS idx_permission_rules_expires ON permission_rules(expires_at);

-- ─── Resource ACLs (per-resource fine-grained permissions) ───────────────
CREATE TABLE IF NOT EXISTS resource_acls (
  id TEXT PRIMARY KEY,
  -- Resource being controlled
  entity_type TEXT NOT NULL CHECK(entity_type IN ('project', 'proposal')),
  entity_id TEXT NOT NULL,
  -- Who gets access
  grantee_type TEXT NOT NULL CHECK(grantee_type IN ('user', 'role')),
  grantee_id TEXT NOT NULL, -- user ID or role name
  -- Permission and effect
  permission TEXT NOT NULL,
  effect TEXT NOT NULL CHECK(effect IN ('grant', 'deny')) DEFAULT 'grant',
  -- Optional expiry for temporary grants
  expires_at INTEGER,
  -- Delegation: who granted this
  granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_resource_acls_entity ON resource_acls(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_resource_acls_grantee ON resource_acls(grantee_type, grantee_id);
CREATE INDEX IF NOT EXISTS idx_resource_acls_expires ON resource_acls(expires_at);
