# Ideator AI Features — Analysis for Porting to Ideate

Source: `/home/dc/work/ideator` (original app)

---

## Overview

Ideator has **5 AI features**, all using a dual-provider LLM system (Gemini primary, OpenAI fallback) with 15-minute throttle per provider on 429 errors.

---

## 1. Project Summary Generation

**What:** Auto-generates a concise summary for each project based on title + description.
**Trigger:** 
- On-demand: "Regenerate Summary" button on project page
- Cron: `/api/cron/project-summaries` processes up to 5 projects without summaries every run
**Files:** `src/lib/project-summary.ts`, `app/api/projects/[id]/summary/route.ts`, `app/api/cron/project-summaries/route.ts`, `src/components/regenerate-summary-button.tsx`

### Prompt (verbatim):
```
Write a terse noun-phrase summary (no imperatives, no second-person, no pleasantries).
Assume the title is shown separately; do not repeat or paraphrase the title or its keywords.
Describe what the project collects (types of proposals/ideas) and any criteria or expectations mentioned; omit if not present.
Keep it neutral/descriptive, as a short label for the project purpose.

Title: {project.title}

Description:
{project.description}
```

### System prompt wrapper:
```
You are summarizing a project or proposal.
Respond ONLY in the "{locale}" language (translate if needed), using correct diacritics for that locale.
Assume the reader already sees the project title separately; do not repeat or rephrase the title or proper names unless essential to meaning.
Write a single crisp sentence with no bullets or headings, removing redundancy and filler.
Keep it easy to read and remember.
Use at most 48 words and at most 320 characters.
```

**Config:** maxTokens=180, temperature=0.4, topP=0.9

---

## 2. Proposal Summary Generation

**What:** Auto-generates a summary when a new proposal is submitted (both manual and AI-suggested).
**Trigger:** Automatic on proposal creation
**Files:** `src/lib/proposal-summary.ts`

### Prompt (verbatim):
```
Provide a concise explanation of what this proposal aims to do and why it matters.
Assume the title is shown separately; do not restate or paraphrase it.

Title: {title}

Description:
{description}
```

Uses same system prompt wrapper as project summaries, with 42 words / 260 chars limit.
**Config:** maxTokens=180, temperature=0.4, topP=0.9

---

## 3. AI Proposal Suggestions (✨ Sparkles Button)

**What:** AI brainstorms up to 3 new proposal ideas for a project, based on context and avoiding duplicates of existing proposals.
**Trigger:** "✨ Sugestii AI" button on project page
**Files:** `app/api/proposals/suggest/route.ts`, `src/components/suggest-proposals.tsx`

### Prompt (verbatim):
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

### UI Flow:
1. User clicks ✨ button → modal opens with loading spinner
2. AI returns up to 3 suggestions with title + summary
3. User can 👍/👎 each suggestion and click "Eye" to see full details (markdown rendered)
4. User submits selected suggestions → they become real proposals with the user's vote

---

## 4. Proposal Similarity Check

**What:** When creating a new proposal, AI checks it against existing proposals for overlap/duplicates. Returns similarity score (0-100) + explanation per existing proposal.
**Trigger:** Automatic when proposal form is filled
**Files:** `app/api/proposals/similarity/route.ts`

### Prompt (verbatim):
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

### Fallback:
If AI fails, uses token-based Jaccard similarity (keyword overlap) — `simpleSimilarity()` function.

---

## 5. LLM Provider System

**What:** Dual-provider with automatic fallback and per-provider throttling.
**Files:** `src/lib/llm.ts`

### Architecture:
```
completeWithFallback(prompt, opts)
  → Try Gemini (primary)
    → If 429 → throttle 15min → try OpenAI
  → Try OpenAI (fallback)
    → If 429 → throttle 15min → return null
  → If both fail → return null (graceful degradation)
```

### Environment Variables:
- `GEMINI_API_KEY` — Gemini API key
- `GEMINI_MODEL` — default: `gemini-2.5-flash-lite`
- `OPENAI_API_KEY` — OpenAI API key  
- `OPENAI_MODEL` — OpenAI model name
- `LOCALE` — app locale for response language (default: `en`)

---

## Summary Table

| Feature | Trigger | Prompt Strategy | Config |
|---------|---------|-----------------|--------|
| Project summary | Button + Cron | Noun-phrase, no title repeat, locale-aware | 48w/320c, temp=0.4 |
| Proposal summary | Auto on create | Concise explanation, no title repeat | 42w/260c, temp=0.4 |
| AI suggestions | ✨ Button | Brainstorm 3 new, structured MD, avoid dupes | 600 tokens, temp=0.65 |
| Similarity check | Auto on new proposal | JSON similarity scores + explanations | 320 tokens, temp=0.2 |
| LLM fallback | All features | Gemini → OpenAI with 15min throttle | Per-provider |

---

## Porting Priorities for Ideate

1. **AI Suggestions (✨)** — Most user-facing value. Full UI with vote+submit flow.
2. **Similarity Check** — Prevents duplicates. Important for quality.
3. **Project Summary** — Auto-generated, shown on dashboard/cards.
4. **Proposal Summary** — Auto-generated on create.
5. **LLM Provider System** — Already exists in Ideate (`src/lib/ai.ts`) but needs update to match the dual-provider pattern.
