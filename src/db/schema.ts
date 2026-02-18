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

// ─── Custom Roles ───────────────────────────────────────────────────────

export const customRoles = sqliteTable("custom_roles", {
  id: pk(),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: text("permissions").notNull().default("[]"),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
  createdAt: ts(), updatedAt: tsUp(),
});
