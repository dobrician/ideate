# Sprint 36 — Enterprise Features & Polish

**Date:** 2026-02-17
**Source:** Deep analysis report — missing enterprise features + remaining polish
**Focus:** File attachments, project archival, bulk operations, notification preferences, advanced sorting

## Goals

- [x] **Goal 1: File attachments on proposals** — Allow users to attach images or files to proposals. Add `attachments` table (id, proposalId, filename, mimeType, size, storagePath, userId, createdAt). Store files in `data/uploads/`. Show attachments on proposal cards with download links. Limit: 5MB per file, 3 files per proposal. Add upload UI with drag-and-drop or file picker. Add tests.

- [ ] **Goal 2: Project archival with read-only mode** — When a project is archived, it becomes fully read-only: no new proposals, no voting, no comments. Show a clear "Archived" banner. Allow admins to unarchive. Ensure all mutation endpoints check project status. Add tests.

- [ ] **Goal 3: Bulk operations for admin** — Add checkboxes to admin user table for bulk role change and bulk delete. Add checkboxes to projects list for bulk archive/delete. Confirmation dialog before destructive bulk operations. Add tests.

- [ ] **Goal 4: Notification preferences** — Add a notifications settings section to user profile. Options: email on new proposal in my projects, email on vote on my proposals, email on comment reply. Store preferences in a `notification_preferences` table. Respect preferences when sending emails. Add tests.

- [ ] **Goal 5: Advanced proposal sorting** — Add sort options to proposal list: by votes (most popular), by date (newest/oldest), by comments (most discussed), by controversy (closest pro/contra ratio). Persist sort preference in URL params. Add tests.

- [ ] **Goal 6: Project categories/tags** — Allow projects to have tags (e.g., "Tech", "Design", "Business"). Add `tags` table and `project_tags` junction table. Show tags on project cards. Allow filtering projects by tag. Admin can manage available tags. Add tests.

- [ ] **Goal 7: Rich text proposals** — Replace plain textarea with a simple markdown editor for proposal descriptions. Support bold, italic, lists, links. Render markdown in proposal cards. Use a lightweight library (e.g., react-markdown). Sanitize output. Add tests.

- [ ] **Goal 8: Dashboard analytics charts** — Add visual charts to dashboard: votes over time (line chart), top proposals (bar chart), activity heatmap (last 30 days). Use a lightweight chart library (e.g., recharts). Make charts responsive. Add tests.

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines or create separate doc commits.
- Commit + push after EACH goal.
