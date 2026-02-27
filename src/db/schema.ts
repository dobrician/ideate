import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const ts = () => integer("created_at", { mode: "timestamp" as const }).default(sql`(unixepoch())`);
const tsUp = () => integer("updated_at", { mode: "timestamp" as const }).default(sql`(unixepoch())`);
const pk = () => text("id").primaryKey().$defaultFn(() => randomUUID());

// ─── Users ───────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash"),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  verificationToken: text("verification_token"),
  verificationTokenExpires: integer("verification_token_expires", { mode: "timestamp" }),
  resetToken: text("reset_token"),
  resetTokenExpires: integer("reset_token_expires", { mode: "timestamp" }),
  role: text("role", { enum: ["admin", "manager", "member", "viewer"] }).notNull().default("member"),
  onboardingCompleted: integer("onboarding_completed", { mode: "boolean" }).notNull().default(false),
  createdAt: ts(), updatedAt: tsUp(),
});

// ─── Projects ────────────────────────────────────────────────────────────

export const projects = sqliteTable("projects", {
  id: pk(),
  title: text("title").notNull(),
  description: text("description"),
  summary: text("summary"),
  deadline: integer("deadline", { mode: "timestamp" }).notNull(),
  status: text("status", { enum: ["active", "archived", "draft"] }).notNull().default("active"),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  teamId: text("team_id"),
  createdAt: ts(), updatedAt: tsUp(),
});

// ─── Proposals ───────────────────────────────────────────────────────────

export const proposals = sqliteTable("proposals", {
  id: pk(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  summary: text("summary"),
  isNegativeInitiative: integer("is_negative_initiative", { mode: "boolean" }).notNull().default(false),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts(), updatedAt: tsUp(),
});

// ─── Votes ───────────────────────────────────────────────────────────────

export const votes = sqliteTable("votes", {
  proposalId: text("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  value: integer("value").notNull(),
  createdAt: ts(), updatedAt: tsUp(),
}, (table) => [primaryKey({ columns: [table.proposalId, table.userId] })]);

// ─── Audit Logs ──────────────────────────────────────────────────────────

export const auditLogs = sqliteTable("audit_logs", {
  id: pk(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: ts(),
});

// ─── Invitations ─────────────────────────────────────────────────────────

export const invitations = sqliteTable("invitations", {
  id: pk(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
  status: text("status", { enum: ["pending", "accepted", "expired"] }).notNull().default("pending"),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: ts(),
});

// ─── Attachments ─────────────────────────────────────────────────────────

export const attachments = sqliteTable("attachments", {
  id: pk(),
  proposalId: text("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  storagePath: text("storage_path").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts(),
});

// ─── Notification Preferences ────────────────────────────────────────────

export const notificationPreferences = sqliteTable("notification_preferences", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  emailNewProposal: integer("email_new_proposal", { mode: "boolean" }).notNull().default(true),
  emailVoteOnMine: integer("email_vote_on_mine", { mode: "boolean" }).notNull().default(true),
  emailCommentReply: integer("email_comment_reply", { mode: "boolean" }).notNull().default(true),
  emailWeeklyDigest: integer("email_weekly_digest", { mode: "boolean" }).notNull().default(false),
  updatedAt: tsUp(),
});

// ─── Comments ────────────────────────────────────────────────────────────

export const comments = sqliteTable("comments", {
  id: pk(),
  proposalId: text("proposal_id").references(() => proposals.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  parentId: text("parent_id").references((): ReturnType<typeof text> => comments.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts(), updatedAt: tsUp(),
});

// ─── Tags ────────────────────────────────────────────────────────────────

export const tags = sqliteTable("tags", {
  id: pk(),
  name: text("name").notNull().unique(),
  createdAt: ts(),
});

export const projectTags = sqliteTable("project_tags", {
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.projectId, table.tagId] })]);

export const proposalTags = sqliteTable("proposal_tags", {
  proposalId: text("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.proposalId, table.tagId] })]);

// ─── Webhooks ────────────────────────────────────────────────────────────

export const webhooks = sqliteTable("webhooks", {
  id: pk(),
  url: text("url").notNull(),
  events: text("events").notNull(),
  secret: text("secret").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: ts(), updatedAt: tsUp(),
});

export const webhookDeliveries = sqliteTable("webhook_deliveries", {
  id: pk(),
  webhookId: text("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: text("payload").notNull(),
  status: text("status", { enum: ["pending", "success", "failed"] }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: integer("last_attempt_at", { mode: "timestamp" }),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  createdAt: ts(),
});

// ─── OAuth Accounts ──────────────────────────────────────────────────────

export const oauthAccounts = sqliteTable("oauth_accounts", {
  id: pk(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  createdAt: ts(),
});

// ─── Revoked Tokens ──────────────────────────────────────────────────────

export const revokedTokens = sqliteTable("revoked_tokens", {
  jti: text("jti").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// ─── LLM Cache ───────────────────────────────────────────────────────────

export const llmCache = sqliteTable("llm_cache", {
  hash: text("hash").primaryKey(),
  prompt: text("prompt").notNull(),
  response: text("response").notNull(),
  modelUsed: text("model_used"),
  ttl: integer("ttl").notNull().default(86400),
  createdAt: ts(),
});

// ─── Project Templates ──────────────────────────────────────────────────

export const projectTemplates = sqliteTable("project_templates", {
  id: pk(),
  name: text("name").notNull(),
  description: text("description"),
  titlePrefix: text("title_prefix"),
  deadlineOffset: integer("deadline_offset"),
  defaultTags: text("default_tags"),
  createdAt: ts(), updatedAt: tsUp(),
});

// ─── Teams ───────────────────────────────────────────────────────────────

export const teams = sqliteTable("teams", {
  id: pk(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts(), updatedAt: tsUp(),
});

export const teamMembers = sqliteTable("team_members", {
  teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "admin", "member", "viewer"] }).notNull().default("member"),
  joinedAt: integer("joined_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
}, (table) => [primaryKey({ columns: [table.teamId, table.userId] })]);

// ─── Job Queue ──────────────────────────────────────────────────────────

export const jobQueue = sqliteTable("job_queue", {
  id: pk(),
  type: text("type").notNull(),
  payload: text("payload").notNull().default("{}"),
  status: text("status", { enum: ["pending", "processing", "completed", "failed", "dead"] }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lastError: text("last_error"),
  runAt: integer("run_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: ts(),
});

// ─── Cache Entries ──────────────────────────────────────────────────

export const cacheEntries = sqliteTable("cache_entries", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  ttl: integer("ttl").notNull().default(300),
  createdAt: integer("created_at").default(sql`(unixepoch())`),
});

// ─── Embeddings ─────────────────────────────────────────────────────────

export const embeddings = sqliteTable("embeddings", {
  id: pk(),
  entityType: text("entity_type", { enum: ["project", "proposal", "comment"] }).notNull(),
  entityId: text("entity_id").notNull(),
  vector: text("vector").notNull(), // JSON-serialized float array
  model: text("model").notNull().default("tfidf"),
  dimensions: integer("dimensions").notNull(),
  createdAt: ts(), updatedAt: tsUp(),
});

// ─── Custom Roles ───────────────────────────────────────────────────────

export const customRoles = sqliteTable("custom_roles", {
  id: pk(),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: text("permissions").notNull().default("[]"),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
  createdAt: ts(), updatedAt: tsUp(),
});

// ─── Workflows ──────────────────────────────────────────────────────────

export const workflows = sqliteTable("workflows", {
  id: pk(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  stages: text("stages").notNull().default("[]"), // JSON stage order
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: ts(), updatedAt: tsUp(),
});

export const workflowStages = sqliteTable("workflow_stages", {
  id: pk(),
  workflowId: text("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  stageOrder: integer("stage_order").notNull().default(0),
  allowedRoles: text("allowed_roles").notNull().default("[]"), // JSON array of roles
  autoAdvance: integer("auto_advance", { mode: "boolean" }).notNull().default(false),
  autoAdvanceAfter: integer("auto_advance_after"), // seconds
  createdAt: ts(),
});

export const proposalWorkflowState = sqliteTable("proposal_workflow_state", {
  proposalId: text("proposal_id").primaryKey().references(() => proposals.id, { onDelete: "cascade" }),
  workflowId: text("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  currentStageId: text("current_stage_id").notNull().references(() => workflowStages.id),
  status: text("status", { enum: ["active", "completed", "rejected"] }).notNull().default("active"),
  enteredAt: integer("entered_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: tsUp(),
});

export const approvalRecords = sqliteTable("approval_records", {
  id: pk(),
  proposalId: text("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
  stageId: text("stage_id").notNull().references(() => workflowStages.id),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action", { enum: ["approve", "reject", "comment"] }).notNull(),
  comment: text("comment"),
  createdAt: ts(),
});

// ─── Permission Rules ───────────────────────────────────────────────────

export const permissionRules = sqliteTable("permission_rules", {
  id: pk(),
  name: text("name").notNull(),
  description: text("description"),
  ruleType: text("rule_type", { enum: ["time_expiry", "schedule", "deadline", "condition"] }).notNull(),
  targetType: text("target_type", { enum: ["user", "role", "all"] }).notNull(),
  targetId: text("target_id"),
  permission: text("permission").notNull(),
  effect: text("effect", { enum: ["grant", "deny"] }).notNull().default("grant"),
  startsAt: integer("starts_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  schedule: text("schedule"), // JSON
  condition: text("condition"), // JSON
  entityType: text("entity_type", { enum: ["project", "proposal"] }),
  entityId: text("entity_id"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts(), updatedAt: tsUp(),
});

// ─── Resource ACLs ──────────────────────────────────────────────────────

export const resourceAcls = sqliteTable("resource_acls", {
  id: pk(),
  entityType: text("entity_type", { enum: ["project", "proposal"] }).notNull(),
  entityId: text("entity_id").notNull(),
  granteeType: text("grantee_type", { enum: ["user", "role"] }).notNull(),
  granteeId: text("grantee_id").notNull(),
  permission: text("permission").notNull(),
  effect: text("effect", { enum: ["grant", "deny"] }).notNull().default("grant"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  grantedBy: text("granted_by").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason"),
  createdAt: ts(),
});

// ─── AI Feedback ──────────────────────────────────────────────────────────

export const aiFeedback = sqliteTable("ai_feedback", {
  id: pk(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  feature: text("feature", { enum: ["routing", "conflicts", "deadlines", "predictions", "suggestions"] }).notNull(),
  entityType: text("entity_type", { enum: ["proposal", "project"] }).notNull(),
  entityId: text("entity_id").notNull(),
  rating: integer("rating").notNull(),
  feedbackType: text("feedback_type", { enum: ["rating", "thumbs", "correction"] }).notNull().default("rating"),
  comment: text("comment"),
  aiOutput: text("ai_output"),
  correction: text("correction"),
  modelVersion: text("model_version"),
  createdAt: ts(),
});

// ─── AI Models ────────────────────────────────────────────────────────────

export const aiModels = sqliteTable("ai_models", {
  id: pk(),
  name: text("name").notNull(),
  feature: text("feature").notNull(),
  version: text("version").notNull(),
  provider: text("provider", { enum: ["gemini", "openai", "local"] }).notNull(),
  config: text("config"),
  accuracy: integer("accuracy"),
  totalPredictions: integer("total_predictions").notNull().default(0),
  correctPredictions: integer("correct_predictions").notNull().default(0),
  status: text("status", { enum: ["active", "inactive", "testing"] }).notNull().default("active"),
  deployedAt: integer("deployed_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  createdAt: ts(),
});

// ─── AI Insights ──────────────────────────────────────────────────────────

export const aiInsights = sqliteTable("ai_insights", {
  id: pk(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  insightType: text("insight_type", { enum: ["trend", "bottleneck", "recommendation", "anomaly"] }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity", { enum: ["info", "warning", "critical"] }).notNull().default("info"),
  data: text("data"),
  status: text("status", { enum: ["active", "dismissed", "resolved"] }).notNull().default("active"),
  dismissedBy: text("dismissed_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts(),
});

// ─── Notification Channel Preferences (AI-powered) ───────────────────────

export const notificationChannelPrefs = sqliteTable("notification_channel_prefs", {
  id: pk(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  channel: text("channel", { enum: ["in_app", "email", "digest"] }).notNull().default("in_app"),
  category: text("category", { enum: ["votes", "comments", "proposals", "ai_insights", "system"] }).notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  digestFrequency: text("digest_frequency", { enum: ["daily", "weekly"] }),
  smartFilter: integer("smart_filter", { mode: "boolean" }).notNull().default(false),
  createdAt: ts(),
  updatedAt: tsUp(),
});

// ─── Search Analytics ────────────────────────────────────────────────────

export const searchAnalytics = sqliteTable("search_analytics", {
  id: pk(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  query: text("query").notNull(),
  mode: text("mode", { enum: ["fts", "semantic", "hybrid"] }).notNull().default("fts"),
  filters: text("filters"), // JSON
  resultCount: integer("result_count").notNull().default(0),
  responseTimeMs: integer("response_time_ms"),
  clickedResultId: text("clicked_result_id"),
  clickedResultType: text("clicked_result_type", { enum: ["project", "proposal", "comment"] }),
  createdAt: ts(),
});

// ─── Saved Searches ──────────────────────────────────────────────────────

export const savedSearches = sqliteTable("saved_searches", {
  id: pk(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  query: text("query").notNull(),
  mode: text("mode", { enum: ["fts", "semantic", "hybrid"] }).notNull().default("fts"),
  filters: text("filters"), // JSON
  createdAt: ts(),
});

// ─── Search Suggestions ──────────────────────────────────────────────────

export const searchSuggestions = sqliteTable("search_suggestions", {
  id: pk(),
  query: text("query").notNull().unique(),
  frequency: integer("frequency").notNull().default(1),
  lastSearchedAt: integer("last_searched_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  avgResults: integer("avg_results").notNull().default(0),
  createdAt: ts(),
});
