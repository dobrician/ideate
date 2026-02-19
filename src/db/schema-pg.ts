/**
 * PostgreSQL schema — mirrors schema.ts but uses pgTable.
 *
 * Key differences from SQLite schema:
 *  - Uses pgTable instead of sqliteTable
 *  - Timestamps use `timestamp` type with `now()` default instead of integer/unixepoch
 *  - Booleans use native `boolean` type instead of integer mode
 *  - Integer columns use `integer` from pg-core
 *  - Exports the same table names so drizzle queries work identically
 */

import { pgTable, text, integer, boolean, timestamp, primaryKey, type AnyPgColumn } from "drizzle-orm/pg-core";
import { randomUUID } from "crypto";

const ts = () => timestamp("created_at").defaultNow();
const tsUp = () => timestamp("updated_at").defaultNow();
const pk = () => text("id").primaryKey().$defaultFn(() => randomUUID());

// ─── Users ───────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash"),
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationToken: text("verification_token"),
  verificationTokenExpires: timestamp("verification_token_expires"),
  resetToken: text("reset_token"),
  resetTokenExpires: timestamp("reset_token_expires"),
  role: text("role", { enum: ["admin", "manager", "member", "viewer"] }).notNull().default("member"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  createdAt: ts(), updatedAt: tsUp(),
});

// ─── Projects ────────────────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: pk(),
  title: text("title").notNull(),
  description: text("description"),
  summary: text("summary"),
  deadline: timestamp("deadline").notNull(),
  status: text("status", { enum: ["active", "archived", "draft"] }).notNull().default("active"),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  teamId: text("team_id"),
  createdAt: ts(), updatedAt: tsUp(),
});

// ─── Proposals ───────────────────────────────────────────────────────────

export const proposals = pgTable("proposals", {
  id: pk(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  summary: text("summary"),
  isNegativeInitiative: boolean("is_negative_initiative").notNull().default(false),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts(), updatedAt: tsUp(),
});

// ─── Votes ───────────────────────────────────────────────────────────────

export const votes = pgTable("votes", {
  proposalId: text("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  value: integer("value").notNull(),
  createdAt: ts(), updatedAt: tsUp(),
}, (table) => [primaryKey({ columns: [table.proposalId, table.userId] })]);

// ─── Audit Logs ──────────────────────────────────────────────────────────

export const auditLogs = pgTable("audit_logs", {
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

export const invitations = pgTable("invitations", {
  id: pk(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
  status: text("status", { enum: ["pending", "accepted", "expired"] }).notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: ts(),
});

// ─── Attachments ─────────────────────────────────────────────────────────

export const attachments = pgTable("attachments", {
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

export const notificationPreferences = pgTable("notification_preferences", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  emailNewProposal: boolean("email_new_proposal").notNull().default(true),
  emailVoteOnMine: boolean("email_vote_on_mine").notNull().default(true),
  emailCommentReply: boolean("email_comment_reply").notNull().default(true),
  emailWeeklyDigest: boolean("email_weekly_digest").notNull().default(false),
  updatedAt: tsUp(),
});

// ─── Comments ────────────────────────────────────────────────────────────

export const comments = pgTable("comments", {
  id: pk(),
  proposalId: text("proposal_id").references(() => proposals.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  parentId: text("parent_id").references((): AnyPgColumn => comments.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts(), updatedAt: tsUp(),
});

// ─── Tags ────────────────────────────────────────────────────────────────

export const tags = pgTable("tags", {
  id: pk(),
  name: text("name").notNull().unique(),
  createdAt: ts(),
});

export const projectTags = pgTable("project_tags", {
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.projectId, table.tagId] })]);

export const proposalTags = pgTable("proposal_tags", {
  proposalId: text("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.proposalId, table.tagId] })]);

// ─── Webhooks ────────────────────────────────────────────────────────────

export const webhooks = pgTable("webhooks", {
  id: pk(),
  url: text("url").notNull(),
  events: text("events").notNull(),
  secret: text("secret").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: ts(), updatedAt: tsUp(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: pk(),
  webhookId: text("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: text("payload").notNull(),
  status: text("status", { enum: ["pending", "success", "failed"] }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  createdAt: ts(),
});

// ─── OAuth Accounts ──────────────────────────────────────────────────────

export const oauthAccounts = pgTable("oauth_accounts", {
  id: pk(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  createdAt: ts(),
});

// ─── Revoked Tokens ──────────────────────────────────────────────────────

export const revokedTokens = pgTable("revoked_tokens", {
  jti: text("jti").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at").defaultNow(),
});

// ─── LLM Cache ───────────────────────────────────────────────────────────

export const llmCache = pgTable("llm_cache", {
  hash: text("hash").primaryKey(),
  prompt: text("prompt").notNull(),
  response: text("response").notNull(),
  modelUsed: text("model_used"),
  ttl: integer("ttl").notNull().default(86400),
  createdAt: ts(),
});

// ─── Project Templates ──────────────────────────────────────────────────

export const projectTemplates = pgTable("project_templates", {
  id: pk(),
  name: text("name").notNull(),
  description: text("description"),
  titlePrefix: text("title_prefix"),
  deadlineOffset: integer("deadline_offset"),
  defaultTags: text("default_tags"),
  createdAt: ts(), updatedAt: tsUp(),
});

// ─── Teams ───────────────────────────────────────────────────────────────

export const teams = pgTable("teams", {
  id: pk(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts(), updatedAt: tsUp(),
});

export const teamMembers = pgTable("team_members", {
  teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "admin", "member", "viewer"] }).notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => [primaryKey({ columns: [table.teamId, table.userId] })]);

// ─── Job Queue ──────────────────────────────────────────────────────────

export const jobQueue = pgTable("job_queue", {
  id: pk(),
  type: text("type").notNull(),
  payload: text("payload").notNull().default("{}"),
  status: text("status", { enum: ["pending", "processing", "completed", "failed", "dead"] }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lastError: text("last_error"),
  runAt: timestamp("run_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: ts(),
});

// ─── Cache Entries ──────────────────────────────────────────────────

export const cacheEntries = pgTable("cache_entries", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  ttl: integer("ttl").notNull().default(300),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Custom Roles ───────────────────────────────────────────────────────

export const customRoles = pgTable("custom_roles", {
  id: pk(),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: text("permissions").notNull().default("[]"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: ts(), updatedAt: tsUp(),
});
