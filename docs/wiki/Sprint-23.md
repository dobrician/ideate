# Sprint 23 — Dashboard Redesign (2026-02-16)
**Status:** IN PROGRESS

## Goals

Based on unified analysis from Claude + Codex (see docs/sprint23-unified-plan.md).

**Bug fixes & hardening:**
- [x] Goal 1: Fix null-safe activity links and error leakage
- [ ] Goal 2: Scope activity feed to user-relevant data
- [ ] Goal 3: Replace platform-wide stats with personal stats

**Layout redesign:**
- [ ] Goal 4: Add Quick Actions bar
- [ ] Goal 5: Add deadline badges and urgency sorting to "Your Projects"
- [ ] Goal 6: Enrich "Your Projects" cards with per-project stats

**Mobile optimization:**
- [ ] Goal 7: Compact mobile stat display
- [ ] Goal 8: Improve mobile activity and search access

**Testing:**
- [ ] Goal 9: Dashboard E2E tests
- [ ] Goal 10: Unit tests for dashboard queries and components

**Polish (if time permits):**
- [ ] Goal 11: Drizzle-native queries replacing raw SQL
- [ ] Goal 12: Sprint 23 log + outcomes in Sprint-Log.md

## Constraints
- Commit + push after EACH goal
- After each goal, edit this file: change `- [ ]` to `- [x]` (do NOT add new lines)
- Lint + type check + tests + build must pass before each push
- All files < 300 lines
- Full unified plan in docs/sprint23-unified-plan.md
