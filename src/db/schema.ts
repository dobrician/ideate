import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// ─── Users ──────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  avatarUrl: text("avatar_url"),
  role: text("role", { enum: ["admin", "manager", "member", "viewer"] })
    .notNull()
    .default("member"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(unixepoch())`
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(unixepoch())`
  ),
});

// ─── Projects ───────────────────────────────────────────────────────────────

export const projects = sqliteTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  summary: text("summary"),
  deadline: integer("deadline", { mode: "timestamp" }).notNull(),
  status: text("status", { enum: ["active", "archived", "draft"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(unixepoch())`
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(unixepoch())`
  ),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
});

// ─── Proposals ──────────────────────────────────────────────────────────────

export const proposals = sqliteTable("proposals", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  summary: text("summary"),
  isNegativeInitiative: integer("is_negative_initiative", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(unixepoch())`
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(unixepoch())`
  ),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
});

// ─── Votes ──────────────────────────────────────────────────────────────────

export const votes = sqliteTable(
  "votes",
  {
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    value: integer("value").notNull(), // 1 (pro) or -1 (contra)
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(unixepoch())`
    ),
  },
  (table) => [primaryKey({ columns: [table.proposalId, table.userId] })]
);

// ─── Comments ───────────────────────────────────────────────────────────────

// ─── Audit Logs ────────────────────────────────────────────────────────────

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(unixepoch())`
  ),
});

// ─── Comments ──────────────────────────────────────────────────────────────

export const comments = sqliteTable("comments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  proposalId: text("proposal_id")
    .notNull()
    .references(() => proposals.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(unixepoch())`
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(unixepoch())`
  ),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
});
