# Sprint 00 — Accessibility Polish, Locale Generics & Coverage Gaps

**Date:** 2026-02-18
**Focus:** Icon button a11y, redundant title cleanup, locale-generic date formatting, close coverage gaps (components/db/profile/projects), proxy.ts tests

## Goals

- [ ] **Goal 1: Icon-only button a11y** — add `aria-label` to `dark-mode-toggle`, `locale-switcher`, `export-buttons`, `attachment-upload` delete button (WCAG 4.1.2)
- [ ] **Goal 2: Remove redundant `title` from comment-thread send button** — already has `aria-label`, remove duplicate `title` attribute
- [ ] **Goal 3: Locale-generic date formatting** — replace hardcoded `en`/`ro` switch in `utils.ts` with BCP 47 locale tag support
- [ ] **Goal 4: Close coverage gap on `src/components`** — raise from 93.75% stmts / 90% branch to 100%
- [ ] **Goal 5: Close coverage gap on `src/db`** — raise from 88.88% branch to 100%
- [ ] **Goal 6: Close coverage gap on `src/app/profile`** — raise from 98.63% stmts / 93.47% branch
- [ ] **Goal 7: Add `proxy.ts` unit tests** — auth proxy currently has zero test coverage
- [ ] **Goal 8: Close coverage gap on `src/app/projects`** — raise from 71.42% funcs / 96.77% branch

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines.
- Commit + push after EACH goal.
