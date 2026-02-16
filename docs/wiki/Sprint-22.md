# Sprint 22 — Auth & Security Deep Dive (2026-02-16)
**Status:** IN PROGRESS

## Goals

Based on unified analysis from both Claude and Codex (see docs/sprint22-unified-plan.md for full 34-task plan).

**Security (highest priority):**
- [ ] Goal 1: Enforce CSRF on all auth mutation routes OR document sameSite as explicit defense
- [ ] Goal 2: Validate JWT in middleware — expired/malformed cookies redirect to login, not app errors
- [ ] Goal 3: Fix reset-password raw Zod error exposure — return user-friendly messages
- [ ] Goal 4: Add rate limiting to reset-password endpoint
- [ ] Goal 5: Hash reset/verification tokens before storing in DB (SHA-256)
- [ ] Goal 6: Add audit logging to all auth events (login, register, reset, verify, logout)

**UX (user-visible):**
- [ ] Goal 7: Create missing verify pages + surface resend-verification on EMAIL_NOT_VERIFIED
- [ ] Goal 8: Add password visibility toggle on all auth pages
- [ ] Goal 9: Fix duplicate page section at bottom (#42) + proposal form should be modal (#41)

**Tests:**
- [ ] Goal 10: Fix stale E2E auth tests + add mobile viewport auth tests
- [ ] Goal 11: Sprint 22 log + outcomes in Sprint-Log.md

## Constraints
- Commit + push after EACH goal
- After each goal, edit this file: change `- [ ]` to `- [x]` (do NOT add new lines)
- Lint + type check + tests + build must pass before each push
- All files < 300 lines
- Deploy to staging and verify after security fixes
- Full unified plan in docs/sprint22-unified-plan.md — remaining tasks carry to Sprint 23+
