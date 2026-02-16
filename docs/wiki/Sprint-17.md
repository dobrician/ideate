# Sprint 17 — Vote Bar Redesign, Comment UI Polish & Migration Fix (2026-02-16)
**Status:** 🏃 IN PROGRESS

## Goals

**Vote Bar Chart Redesign (#34):**
- [x] Background only on title bar row, not expanded body (#34)
- [x] Green bar from left (pro), red bar from right (contra), growing toward each other (#34)
- [x] Proportional width: max total votes = 100%, others scale relative (#34)
- [x] Sort: descending by (pro - contra), tie-break ascending by negative votes (#34)

**Comment UI Polish:**
- [x] Comment drawer/section: textarea + button at top, not bottom (#32)
- [ ] Style submit button as primary (rounded, colored, consistent with UI) (#33)

**Infrastructure:**
- [ ] Fix migration runner to apply new migrations on deploy (#36)

## Constraints
- Commit + push after EACH fix
- After each goal, edit this file: change `- [ ]` to `- [x]` (do NOT add new lines)
- Lint + type check + tests + build must pass before each push
