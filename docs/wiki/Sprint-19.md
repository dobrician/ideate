# Sprint 19 — AI Features from Ideator (2026-02-16)
**Status:** 🏃 IN PROGRESS

## Goals

**Foundation:**
- [x] Project summary generation library — src/lib/project-summary.ts with ideator prompts
- [x] Markdown renderer component — src/components/markdown-renderer.tsx
- [x] AI suggestions API — POST /api/proposals/suggest with brainstorm prompt
- [x] i18n keys for all AI UI strings (EN + RO, ~20 keys)

**APIs:**
- [x] Project summary API + Regenerate Summary button on project page
- [x] Cron endpoint for batch project summaries — /api/cron/project-summaries
- [x] Submit-suggested API — create proposals from AI suggestions with auto-vote

**UI:**
- [x] AI Suggestions sparkles button + modal (vote/preview/submit flow) (#40-logo can wait)
- [x] Proposal similarity check API + inline UI warnings on proposal form

**Polish:**
- [ ] Integration tests for AI endpoints + cleanup

## Constraints
- Commit + push after EACH goal
- After each goal, edit this file: change `- [ ]` to `- [x]` (do NOT add new lines)
- Lint + type check + tests + build must pass before each push
- PRESERVE original prompts from ideator verbatim — see docs/sprint-ai-features.md
