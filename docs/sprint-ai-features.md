# Sprint: AI Features — Port from Ideator to Ideate

> Source analysis: `docs/ideator-ai-analysis.md`
> Date: 2026-02-16

---

## Status Baseline

**Already working in Ideate:**
- `src/lib/llm.ts` — Dual-provider LLM (Gemini primary, OpenAI fallback) with 15-min throttle + hourly rate limits + cost tracking
- `src/lib/ai.ts` — `generateSummaryFromText()`, `buildProposalSummary()`, `fallbackSummary()`
- Proposal auto-summary on create (called in `src/app/projects/[id]/proposals/actions.ts:createProposal`)
- `summary` columns exist in both `projects` and `proposals` tables — no migration needed
- Auth (JWT sessions), RBAC, CSRF all wired up
- i18n system (EN + RO) with `getTranslations()` / `useLocale()`

**Missing — to be built this sprint:**
1. Project summary generation (on-demand + cron)
2. AI proposal suggestions (sparkles button + modal + vote/submit flow)
3. Submit-suggested API (create proposals from AI suggestions)
4. Proposal similarity check (API + inline UI warnings)
5. Markdown renderer component (for AI suggestion details)
6. i18n keys for all new AI UI strings

---

## Goal 1: Project Summary Generation Library

**What:** Create `src/lib/project-summary.ts` — generates AI summary for a project using the same LLM system that already powers proposal summaries.

**Files to create:**
- `src/lib/project-summary.ts`

**Prompt to preserve (verbatim from ideator):**
```
Write a terse noun-phrase summary (no imperatives, no second-person, no pleasantries).
Assume the title is shown separately; do not repeat or paraphrase the title or its keywords.
Describe what the project collects (types of proposals/ideas) and any criteria or expectations mentioned; omit if not present.
Keep it neutral/descriptive, as a short label for the project purpose.

Title: {project.title}

Description:
{project.description}
```

**System prompt wrapper (already in ai.ts `generateSummaryFromText`):**
```
You are summarizing a project or proposal.
Respond ONLY in the "{locale}" language (translate if needed), using correct diacritics for that locale.
Assume the reader already sees the project title separately; do not repeat or rephrase the title or proper names unless essential to meaning.
Write a single crisp sentence with no bullets or headings, removing redundancy and filler.
Keep it easy to read and remember.
Use at most 48 words and at most 320 characters.
```

**Config:** maxTokens=180, temperature=0.4, topP=0.9

**Implementation notes:**
- Reuse `generateSummaryFromText` and `fallbackSummary` from `src/lib/ai.ts` (already exist)
- Query project from DB, build prompt, call AI, update `projects.summary`
- `revalidatePath("/dashboard")` + `revalidatePath(/projects/${id})`
- Match the pattern from ideator's `src/lib/project-summary.ts` exactly

**Effort:** Small — ~30 min. Pure server logic, no UI.

**Dependencies:** None (ai.ts and llm.ts already exist).

---

## Goal 2: Project Summary API Route + Regenerate Button

**What:** On-demand "Regenerate Summary" button on project page for project owners/admins.

**Files to create:**
- `src/app/api/projects/[id]/summary/route.ts` — POST endpoint
- `src/components/regenerate-summary-button.tsx` — client component

**Files to modify:**
- `src/app/projects/[id]/page.tsx` — add button next to summary display (around line 147-153)
- `src/lib/translations/en.ts` — add keys
- `src/lib/translations/ro.ts` — add keys

**New i18n keys:**
```typescript
// en.ts
"projectSummary.regenerate": "Regenerate Summary",
"projectSummary.regenerating": "Generating...",
"projectSummary.success": "Summary updated",
"projectSummary.error": "Could not generate summary",

// ro.ts
"projectSummary.regenerate": "Regenerează rezumatul",
"projectSummary.regenerating": "Se generează...",
"projectSummary.success": "Rezumat actualizat",
"projectSummary.error": "Nu s-a putut genera rezumatul",
```

**API route logic:**
1. `requireAuth()` + RBAC check (project owner or admin)
2. Call `generateProjectSummary(id, { force: true })`
3. Return `{ summary }` or `{ error }`

**UI:** Small button with `RefreshCw` icon next to the summary `<div>`. Only visible to project owner or admin. Uses `fetch` + `router.refresh()` on success.

**Effort:** Small-medium — ~45 min.

**Dependencies:** Goal 1 (project-summary.ts).

---

## Goal 3: Cron Endpoint for Batch Project Summaries

**What:** API endpoint that processes up to 5 projects without summaries per invocation. For use with external cron (Vercel cron, systemd timer, etc.).

**Files to create:**
- `src/app/api/cron/project-summaries/route.ts`

**Implementation:**
```typescript
// GET /api/cron/project-summaries
// Auth: check for CRON_SECRET header or skip auth for cron
// Query: SELECT * FROM projects WHERE summary IS NULL LIMIT 5
// For each: call generateProjectSummary(id)
// Return: { processed: number, errors: number }
```

**Security:** Validate `Authorization: Bearer ${CRON_SECRET}` header. Add `CRON_SECRET` to `.env.example`.

**Effort:** Small — ~20 min.

**Dependencies:** Goal 1 (project-summary.ts).

---

## Goal 4: Markdown Renderer Component

**What:** Lightweight `<MarkdownRenderer>` component for rendering structured markdown from AI suggestion details.

**Files to create:**
- `src/components/markdown-renderer.tsx`

**Dependencies to install:**
```bash
npm install react-markdown remark-gfm
```

**Implementation:**
```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = { content: string; className?: string };

export function MarkdownRenderer({ content, className }: Props) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} className={className}>
      {content}
    </ReactMarkdown>
  );
}
```

Tailwind prose styles already available via `@tailwindcss/typography` if installed, otherwise use custom classes matching our design system.

**Effort:** Small — ~20 min.

**Dependencies:** None (but must be done before Goal 5).

---

## Goal 5: AI Proposal Suggestions API

**What:** `POST /api/proposals/suggest` — AI brainstorms up to 3 new proposal ideas for a project.

**Files to create:**
- `src/app/api/proposals/suggest/route.ts`

**Prompt to preserve (verbatim from ideator):**
```
You are helping a team brainstorm NEW proposals for a project.
Respond ONLY in {locale} (app locale from LOCALE env) with JSON array of up to 3 objects, each having "title", "details", and "summary".
Write "details" in structured Markdown with clear sections (use ## headings) and concise bullet lists/sub-lists for implementation notes/steps; provide enough context to act on the idea.
Each summary must be at most 240 characters. Do not number or bullet inside values.
Avoid duplicating or rephrasing existing proposals; skip anything that is too close.

Project title: {project.title}

Project description: {project.description}

Existing proposals (avoid similar):
1. {proposal.title} — {proposal.description}
...

Return JSON like: [{"title":"...","details":"...","summary":"..."}]
```

**Config:** maxTokens=600, temperature=0.65

**Request shape:**
```typescript
{ project: { title, description }, proposals: [{ title, description, summary }], locale? }
```

**Response shape:**
```typescript
{ proposals: [{ title, details, summary }] }
// or
{ proposals: [], error: "No suggestions" }
```

**Implementation notes:**
- Port `buildPrompt()` and `tryParseSuggestions()` directly from ideator
- `requireAuth()` — must be logged in
- `tryParseSuggestions` extracts JSON array from LLM output (handles code fences, extra text)
- Graceful degradation: return empty array if LLM fails

**Effort:** Medium — ~45 min.

**Dependencies:** None (uses existing llm.ts).

---

## Goal 6: Submit-Suggested Proposals API

**What:** `POST /api/proposals/submit-suggested` — creates real proposals from AI-suggested ones, with the user's vote.

**Files to create:**
- `src/app/api/proposals/submit-suggested/route.ts`

**Request shape:**
```typescript
{
  projectId: string,
  proposals: [{ title, details, summary, vote: 1 | -1 }]
}
```

**Implementation:**
1. `requireAuth()` + RBAC check (`proposal:create`)
2. CSRF validation
3. Validate `projectId` exists
4. For each proposal:
   - Insert into `proposals` table (title, description=details, summary, projectId, userId)
   - Insert into `votes` table (userId, proposalId, value=vote)
   - Audit log entry
5. `revalidatePath`
6. Return `{ created: number }`

**Effort:** Medium — ~45 min.

**Dependencies:** None (uses existing DB schema and auth).

---

## Goal 7: AI Suggestions UI (Sparkles Button + Modal)

**What:** Full client-side UI for the AI suggestions flow — the most complex UI piece.

**Files to create:**
- `src/components/suggest-proposals.tsx`

**Files to modify:**
- `src/app/projects/[id]/page.tsx` — add `<SuggestProposalsButton>` next to `<ProposalForm>`
- `src/lib/translations/en.ts` — add suggestion keys
- `src/lib/translations/ro.ts` — add suggestion keys

**New i18n keys:**
```typescript
// en.ts
"suggestions.cta": "AI Suggestions",
"suggestions.title": "AI Suggestions",
"suggestions.subtitle": "AI-generated proposal ideas for this project",
"suggestions.generating": "Generating suggestions...",
"suggestions.none": "No suggestions could be generated",
"suggestions.error": "Something went wrong generating suggestions",
"suggestions.noSummary": "No summary available",
"suggestions.viewDetails": "View details",
"suggestions.cancel": "Cancel",
"suggestions.close": "Close",
"suggestions.addSelected": "Add selected",
"suggestions.submitting": "Adding...",

// ro.ts
"suggestions.cta": "Sugestii AI",
"suggestions.title": "Sugestii AI",
"suggestions.subtitle": "Idei de propuneri generate de AI pentru acest proiect",
"suggestions.generating": "Se generează sugestii...",
"suggestions.none": "Nu s-au putut genera sugestii",
"suggestions.error": "A apărut o eroare la generarea sugestiilor",
"suggestions.noSummary": "Niciun rezumat disponibil",
"suggestions.viewDetails": "Vezi detalii",
"suggestions.cancel": "Anulează",
"suggestions.close": "Închide",
"suggestions.addSelected": "Adaugă selectate",
"suggestions.submitting": "Se adaugă...",
```

**UI flow (port from ideator's `suggest-proposals.tsx`):**
1. `<Button>` with `<Sparkles>` icon — triggers `generate()`
2. Modal overlay opens with loading spinner
3. On success: renders up to 3 suggestion cards, each with:
   - Title + summary (line-clamped)
   - Hover-reveal action bar: 👍 / 👎 / 👁 (Eye for details)
4. Eye button opens a nested detail modal with `<MarkdownRenderer>` for full `details`
5. Bottom bar: Cancel + "Add selected" (disabled until at least one vote)
6. Submit: POST to `/api/proposals/submit-suggested` → `router.refresh()` → close modal

**Key adaptations from ideator:**
- Use our `useLocale()` hook instead of passing locale as prop
- Use our `Button`, `Card` from `src/components/ui/`
- Use our CSRF token pattern (include in submit request)
- Icons: `Sparkles`, `ThumbsUp`, `ThumbsDown`, `Eye`, `X`, `Loader2` — all from `lucide-react` (already installed)

**Effort:** Large — ~90 min. Complex client component with two modal layers, state management, and API integration.

**Dependencies:** Goal 4 (markdown renderer), Goal 5 (suggest API), Goal 6 (submit API).

---

## Goal 8: Proposal Similarity Check API

**What:** `POST /api/proposals/similarity` — checks a new proposal against existing ones for overlap.

**Files to create:**
- `src/app/api/proposals/similarity/route.ts`

**Prompt to preserve (verbatim from ideator):**
```
We have a project and a list of existing proposals for it.
Return a JSON object where each key is an existing proposal ID and value is { "similarity": 0-100, "explanation": "<human, concise reason in {locale}>" }.
Compare each existing proposal one-to-one against the NEW proposal provided.
Use the project context to understand intent and avoid keyword-only reasoning.
Be specific (e.g., overlapping KPIs, duplicate features, same outcomes).
Respond ONLY with valid JSON, no prose, no code fences.

Project:
{project JSON}

Existing proposals (JSON map by id):
{existing proposals JSON}

New proposal:
{new proposal JSON}
```

**Config:** maxTokens=320, temperature=0.2, topP=0.8

**Implementation notes — port directly from ideator:**
- `extractJson(text)` — robust JSON parser with regex fallback for malformed/truncated output
- `simpleSimilarity(a, b)` — Jaccard token overlap fallback when LLM fails
- `fallbackSimilarities()` — generates keyword-based scores for all existing proposals
- Ensure every existing proposal is represented in response (fill gaps with 0 similarity)
- `requireAuth()`

**Response shape:**
```typescript
{ matches: [{ id, similarity: 0-100, explanation }] }
```

**Effort:** Medium — ~45 min. Mostly porting + adapting auth.

**Dependencies:** None (uses existing llm.ts).

---

## Goal 9: Similarity Check UI in Proposal Form

**What:** Inline similarity warnings in the proposal creation form.

**Files to modify:**
- `src/components/proposal-form.tsx` — add debounced similarity check + warning display

**New i18n keys:**
```typescript
// en.ts
"similarity.checking": "Checking for similar proposals...",
"similarity.warning": "Similar to existing proposal",
"similarity.score": "{score}% similar",
"similarity.explanation": "{explanation}",
"similarity.highOverlap": "High overlap detected — consider reviewing existing proposals",

// ro.ts
"similarity.checking": "Se verifică propunerile similare...",
"similarity.warning": "Similar cu o propunere existentă",
"similarity.score": "{score}% similar",
"similarity.explanation": "{explanation}",
"similarity.highOverlap": "Suprapunere ridicată detectată — verifică propunerile existente",
```

**Implementation:**
1. Add `useState` for `similarMatches`, `checkingSimiliarity`
2. On blur of title or description (debounced ~800ms), if both have content:
   - POST `/api/proposals/similarity` with `{ project, existing, proposal }`
   - `existing` = array of current proposals (passed as prop to ProposalForm)
3. Display warning cards for matches with similarity > 40:
   - Yellow/amber card with `AlertTriangle` icon
   - Shows explanation text from AI
   - Does NOT block submission — just warns
4. Clear warnings when title/description changes significantly

**Changes to ProposalForm:**
- Accept new prop: `existingProposals: { id, title, description, summary }[]`
- Accept new props: `projectTitle`, `projectDescription`
- Update `src/app/projects/[id]/page.tsx` to pass these props

**Effort:** Medium-large — ~60 min. Requires careful UX for non-blocking warnings.

**Dependencies:** Goal 8 (similarity API).

---

## Goal 10: Integration Testing + Env Config Cleanup

**What:** Ensure all features work end-to-end, update env config, add missing env vars to `.env.example`.

**Files to modify:**
- `.env.example` — add `CRON_SECRET`, `AI_MAX_REQUESTS_PER_HOUR`, `AI_MAX_TOKENS_PER_HOUR`, `LOCALE`
- `src/middleware.ts` — add `/api/cron/project-summaries` to allowed paths (cron auth is handled in the route itself)

**Testing checklist:**
- [ ] Project summary generation: create project → regenerate button works
- [ ] Cron summary: call GET `/api/cron/project-summaries` with correct auth header
- [ ] AI suggestions: click sparkles → modal → vote → submit → proposals created
- [ ] Similarity check: type proposal title → see similarity warnings
- [ ] Fallback: disable API keys → verify Jaccard fallback works for similarity
- [ ] Fallback: disable API keys → verify summary falls back to description truncation
- [ ] RBAC: viewer cannot see suggestion button or regenerate button
- [ ] i18n: switch locale → all new strings render correctly in both EN and RO

**Effort:** Medium — ~45 min.

**Dependencies:** All previous goals.

---

## Dependency Graph

```
Goal 1 (project-summary lib)
├── Goal 2 (regenerate button + API)
└── Goal 3 (cron endpoint)

Goal 4 (markdown renderer)
└── Goal 7 (suggestions UI) ← also needs Goal 5, Goal 6

Goal 5 (suggest API)
└── Goal 7 (suggestions UI)

Goal 6 (submit-suggested API)
└── Goal 7 (suggestions UI)

Goal 8 (similarity API)
└── Goal 9 (similarity UI)

Goal 10 (integration + cleanup) ← needs all above
```

**Recommended execution order:**

```
Phase 1 — Foundation (parallel):
  Goal 1 + Goal 4 + Goal 5 + Goal 8

Phase 2 — APIs (parallel):
  Goal 2 + Goal 3 + Goal 6

Phase 3 — UI:
  Goal 7 (suggestions UI — largest task)
  Goal 9 (similarity UI)

Phase 4 — Polish:
  Goal 10 (testing + cleanup)
```

---

## Effort Summary

| Goal | Task | Effort |
|------|------|--------|
| 1 | Project summary lib | ~30 min |
| 2 | Regenerate button + API | ~45 min |
| 3 | Cron endpoint | ~20 min |
| 4 | Markdown renderer | ~20 min |
| 5 | AI suggestions API | ~45 min |
| 6 | Submit-suggested API | ~45 min |
| 7 | AI suggestions UI | ~90 min |
| 8 | Similarity check API | ~45 min |
| 9 | Similarity check UI | ~60 min |
| 10 | Integration + cleanup | ~45 min |
| **Total** | | **~7.5 hours** |

---

## Files Created (new)

```
src/lib/project-summary.ts
src/app/api/projects/[id]/summary/route.ts
src/app/api/cron/project-summaries/route.ts
src/app/api/proposals/suggest/route.ts
src/app/api/proposals/submit-suggested/route.ts
src/app/api/proposals/similarity/route.ts
src/components/regenerate-summary-button.tsx
src/components/suggest-proposals.tsx
src/components/markdown-renderer.tsx
```

## Files Modified (existing)

```
src/app/projects/[id]/page.tsx          — add regenerate button + sparkles button
src/components/proposal-form.tsx        — add similarity check UI
src/lib/translations/en.ts             — add ~20 new keys
src/lib/translations/ro.ts             — add ~20 new keys
src/middleware.ts                       — add cron path
.env.example                           — add CRON_SECRET, LOCALE, AI rate limit vars
```
