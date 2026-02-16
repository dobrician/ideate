# Project-Level Comments — Design Spike (#19)

**Date:** 2026-02-16
**Status:** Design-only (no code changes)

## Problem

Comments currently exist only on proposals (`comments.proposalId NOT NULL`).
Users need a way to discuss a project as a whole — ask questions about scope,
flag deadline concerns, or give general feedback — without attaching remarks to
a specific proposal.

---

## 1. Schema Additions

Extend the existing `comments` table rather than creating a separate table.
This keeps the threading logic, audit trail, and notification plumbing in one
place.

```sql
-- Migration: add-project-comments
ALTER TABLE comments ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE comments ALTER COLUMN proposal_id DROP NOT NULL;
-- (SQLite requires table rebuild for dropping NOT NULL; Drizzle handles this.)
```

**Drizzle schema change** (`src/db/schema.ts`):

```ts
export const comments = sqliteTable("comments", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  proposalId: text("proposal_id").references(() => proposals.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
});
```

**Constraint:** Exactly one of `proposalId` or `projectId` must be non-null.
Enforce with a CHECK constraint in the migration:

```sql
CHECK (
  (proposal_id IS NOT NULL AND project_id IS NULL)
  OR (proposal_id IS NULL AND project_id IS NOT NULL)
)
```

**Index:** `CREATE INDEX idx_comments_project_id ON comments(project_id)` for
fast project-level lookups.

---

## 2. API Routes

Reuse the existing `addComment` server action with minimal changes:

| Change | Detail |
|--------|--------|
| Validation schema | Accept either `proposalId` or `projectId` (exactly one required). |
| Insert | Pass whichever ID is present; the other stays `null`. |
| Audit log | Add `"project_comment"` action type alongside existing `"comment"`. |
| Permission | Same `comment:create` permission; deadline gate already checks `projectId`. |

**New query** in `src/app/projects/[id]/queries.ts`:

```ts
export async function getProjectComments(projectId: string) {
  return db
    .select({
      id: comments.id,
      content: comments.content,
      parentId: comments.parentId,
      userId: comments.userId,
      userEmail: users.email,
      userName: users.firstName,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.projectId, projectId))
    .orderBy(asc(comments.createdAt));
}
```

No new API route files required — server actions keep the pattern consistent
with proposal comments.

---

## 3. UI Placement

Add a "Discussion" section below the proposals block on the project detail
page (`src/app/projects/[id]/page.tsx`), inside the existing `<Card>`:

```
<CardContent>
  ... existing proposals section ...

  <div className="border-t pt-6 mt-6">        ← new section
    <h2>Discussion</h2>
    <ProjectComments
      projectId={id}
      comments={projectComments}
      commentCount={projectComments.length}
    />
  </div>
</CardContent>
```

**Component:** Create `src/components/project-comments.tsx` — a thin wrapper
around the existing `DiscussionSheet` threading/rendering logic
(`buildCommentTree`, `CommentNode`). Extract the shared tree-building and
comment-node code into a `src/components/comment-thread.tsx` to avoid
duplication.

**Wireframe:**

```
┌─────────────────────────────────────────────┐
│  Project Title                    [Export]   │
│  Status: Active    Deadline: 5 days left     │
│─────────────────────────────────────────────│
│  Summary block                               │
│  Description block                           │
│─────────────────────────────────────────────│
│  3 Proposals              [+ Add Proposal]   │
│  ... proposal accordion ...                  │
│─────────────────────────────────────────────│
│  Discussion (4 comments)                     │  ← NEW
│                                              │
│  ┌─ Alice · 2h ago ─────────────────────┐   │
│  │ Should we extend the deadline?       │   │
│  │           [Reply]                     │   │
│  │  └─ Bob · 1h ago                     │   │
│  │    No, let's keep it tight.          │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  [textarea: Add a comment...]   [Post]       │
└─────────────────────────────────────────────┘
```

---

## 4. Estimated Effort

| Task | Estimate |
|------|----------|
| Migration + schema change | 1 hour |
| Extract shared comment-thread component | 1-2 hours |
| `ProjectComments` component + form wiring | 1-2 hours |
| Query function + server action changes | 1 hour |
| Tests (unit + component) | 1-2 hours |
| **Total** | **5-8 hours** |

---

## 5. Open Questions

- **Collapse by default?** If a project has many comments, should the section
  start collapsed (accordion) or always be open?
- **Notification scope:** Should project-comment notifications go to the project
  owner only, or to all users who have voted/commented on any proposal?
- **Comment editing/deletion:** Currently not supported for proposal comments
  either. If added, it should apply to both kinds.
