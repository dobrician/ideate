-- Sprint 64: Add missing indexes on foreign key columns for query performance
-- 7 FK columns identified without indexes

-- teams.owner_id → users.id (team ownership lookups)
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id);

-- webhook_deliveries.webhook_id → webhooks.id (delivery history lookups)
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);

-- proposal_workflow_state.current_stage_id → workflow_stages.id (stage transitions)
CREATE INDEX IF NOT EXISTS idx_proposal_workflow_state_stage ON proposal_workflow_state(current_stage_id);

-- permission_rules.created_by → users.id (audit trail)
CREATE INDEX IF NOT EXISTS idx_permission_rules_created_by ON permission_rules(created_by);

-- resource_acls.granted_by → users.id (audit trail)
CREATE INDEX IF NOT EXISTS idx_resource_acls_granted_by ON resource_acls(granted_by);

-- ai_insights.dismissed_by → users.id (insight dismissal tracking)
CREATE INDEX IF NOT EXISTS idx_ai_insights_dismissed_by ON ai_insights(dismissed_by);

-- integrations.created_by → users.id (integration ownership)
CREATE INDEX IF NOT EXISTS idx_integrations_created_by ON integrations(created_by);
