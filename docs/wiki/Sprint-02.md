# Sprint 02 — Branch Coverage Ceiling & File Size Compliance

**Date:** 2026-02-18
**Focus:** Close all remaining branch coverage gaps (webhooks, llm-cache, llm, mail, comment-utils, search, auth, oidc, password), resolve export.ts barrel false positive, split oversized openapi-spec.ts

## Goals

- [x] **Goal 1: Close function/branch gap on `lib/webhooks.ts`** — test `deliverWebhook` (success, retry, permanent failure paths); currently 83.33% function coverage (Testing)
- [x] **Goal 2: Close branch gap on `lib/llm-cache.ts`** — test null `createdAt` fallback on line 52; currently 85.71% branch (Testing)
- [x] **Goal 3: Close branch gaps on `lib/llm.ts`** — test OpenAI-only path (no GEMINI_KEY), undefined `tokensUsed`, cost-lookup null fallbacks; currently 91.66% branch (Testing)
- [x] **Goal 4: Close branch gaps on `lib/mail.ts`, `lib/comment-utils.ts`, `lib/search.ts`** — test SMTP_PORT/SMTP_FROM defaults, null `createdAt` sort, missing DATABASE_URL fallback (Testing)
- [x] **Goal 5: Close branch gaps on `lib/auth.ts`, `lib/oidc.ts`, `lib/password.ts`** — test tokens without exp/jti, missing APP_URL+OIDC_REDIRECT_URI, null emailVerified (Testing)
- [ ] **Goal 6: Resolve `lib/export.ts` coverage false positive** — exclude barrel re-export file from coverage config or add smoke import test (Testing)
- [ ] **Goal 7: Split `lib/openapi-spec.ts` (835 lines) into modules** — each under 300 lines, maintain all existing exports (Code Quality)
- [ ] **Goal 8: Verify branch coverage above 99%** — confirm all gaps closed, overall branch coverage ≥ 99% (Testing)

## Notes

- After each goal, edit this file: change `- [ ]` to `- [x]` for that goal. Do NOT add new lines.
- Commit + push after EACH goal.
