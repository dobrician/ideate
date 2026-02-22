# Sprint 19 — AI Features from Ideator (2026-02-16)
**Status:** ✅ COMPLETE

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
- [x] Integration tests for AI endpoints + cleanup

## Constraints
- Commit + push after EACH goal
- Lint + type check + tests + build must pass before each push
- PRESERVE original prompts from ideator verbatim — see docs/sprint-ai-features.md

## Outcomes
- 10 incremental commits, **32/32 smoke** (12.7s), **30 new tests**
- Ported ALL AI features from ideator with original prompts preserved:
  - Project summary generation (lib + API + regenerate button + cron batch)
  - AI proposal suggestions (✨ sparkles button, modal, vote/preview/submit)
  - Proposal similarity check (API + inline UI warnings on form)
  - Submit-suggested API (create proposals from AI suggestions)
  - Markdown renderer for AI suggestion details
  - 20+ i18n keys (EN + RO)
- New files: 9 created, 6 modified
- LLM: Gemini primary + OpenAI fallback with 15-min throttle (preserved from ideator)

## Notes
- Cleanest sprint yet — 10/10 in single session, no max turns hit
- All prompts verbatim from ideator, adapted to our architecture
- GEMINI_API_KEY needed in .env for AI features to work on staging
