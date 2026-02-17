# Sprint 31 — Design Polish & Layout Improvements

**Date:** 2026-02-17
**Source:** Manual mobile testing screenshots + feedback

## Goals

- [x] **Goal 1: Project detail layout restructure** — Move action buttons (PDF, CSV, Edit, Delete) inside the project card or into a compact action bar. Replace full-width "Back to Projects" button with a simple `← Back` text link. Reduce vertical spacing between nav and content. Put Delete behind a "⋯" menu or make it less prominent (muted style, not red button).

- [x] **Goal 2: Fix "+ New Proposal" button truncation on mobile** — Text gets cut off ("+ New Prop..."). Either shorten to "+ Propunere" / "+ Nou" on mobile, or use icon-only "+" button on small screens. Ensure "Proposals (N)" heading and action buttons align on the same visual line.

- [x] **Goal 3: Proposal card author name wrapping** — When author name is long, it wraps awkwardly (e.g., "by Ciprian" on one line, "Dobrea" alone on next). Use `truncate` or abbreviate on small screens. Ensure consistent layout across cards.

- [x] **Goal 4: Vote bar explanation** — Add a small tooltip or legend explaining what the green vote bar means (e.g., "Approval ratio" on hover/tap). First-time users have no context for it.

- [ ] **Goal 5: Date formatting respects locale** — Dates like "February 16, 2026" should display as "16 februarie 2026" when locale is RO. Audit all date displays (Created, Last Updated, deadline) and use locale-aware formatting via the i18n system.

- [ ] **Goal 6: Proposal expand UX clarity** — The chevron (˅) on each proposal card should make it clear what expands (description? comments? both?). Add a subtle hint like "Detalii" next to the chevron, or show a preview line of the description below the title.

- [ ] **Goal 7: Equal-vote sorting** — When proposals have equal votes, add secondary sort by newest first (created_at DESC). Ensure this is consistent in both server queries and client-side sorting.

- [ ] **Goal 8: General mobile spacing polish** — Review all pages on 375px viewport. Fix any overflow, awkward wrapping, or excessive spacing. Ensure consistent padding and margins across project detail, proposals, dashboard, and admin pages.

## Notes

- Screenshots from Ciprian's iPhone (dark mode, 5G) showing real usage
- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines or create separate doc commits.
- Commit + push after EACH goal.
