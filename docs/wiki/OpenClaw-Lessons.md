# OpenClaw + Claude Code — Development Workflow Guide

How to run a software project using OpenClaw as project manager and Claude Code as developer. Lessons from building Ideate across 14 sprints.

---

## Architecture

```
You (human) ←→ OpenClaw (WhatsApp/Telegram) ←→ Claude Code (coding agent)
                     ↓                              ↓
              Project management              Code, tests, commits
              Heartbeat monitoring            Sprint execution
              Deploy & verify                 Git push
              Wiki & docs sync               File edits
```

**OpenClaw** = your AI assistant running 24/7. Manages the project, monitors progress, handles deployment, communicates with you.

**Claude Code** = the developer. Launched by OpenClaw as a background process. Writes code, runs tests, commits, pushes. No memory between sessions.

---

## Sprint Lifecycle

### 1. Post-Sprint (automatic, no human input needed)
```
Sprint finished → OpenClaw detects completion → executes:
  1. npm run lint + tsc + test + build
  2. Check CI green (gh run list)
  3. Deploy to staging (docker compose up -d --build)
  4. Run smoke tests (npm run test:smoke)
  5. Update Sprint-NN.md with Outcomes section
  6. Git commit + push
  7. Write retrospective in memory/YYYY-MM-DD.md
  8. Update MEMORY.md with lessons
```

### 2. Analysis (automatic, between sprints)
```
  9. Launch Claude Code for deep codebase analysis
  10. Read analysis report
  11. Extract priorities
```

### 3. Pre-Sprint (automatic)
```
  12. Define Sprint N+1 goals FROM the analysis
  13. Create docs/wiki/Sprint-NN.md with goals
  14. Update docs/wiki/Sprint-Log.md summary
  15. Git commit + push (triggers wiki sync)
  16. Launch Claude Code with sprint prompt
```

### 4. During Sprint (heartbeat monitoring every ~30 min)
```
  - Check git log for new commits
  - If no commits → check if Claude Code is alive → restart if dead
  - Wiki sync check (auto via GitHub Actions)
  - Server health (disk, RAM, Docker, staging responds)
```

**Key file:** `memory/sprint-state.json` — tracks which step we're on:
```json
{
  "currentSprint": 14,
  "status": "complete",
  "postSprintDone": true,
  "analysisDone": false,
  "preSprintDone": false,
  "nextSprint": 15
}
```

---

## Launching Claude Code

### Command
```bash
claude -p "<prompt>" --max-turns 120 --dangerously-skip-permissions
```

- `--dangerously-skip-permissions` is **MANDATORY** for non-interactive mode
- `--max-turns 120` = ~1 hour of work. Use 80 for smaller sprints
- Launch via `exec(background=true, yieldMs=30000, timeout=3600)`
- Always run from the project directory

### The Sprint Prompt Template
```
Sprint N — [Title]. Do IN ORDER, commit+push after EACH:

1. [Goal with specific details, file paths, what to change] (#issue)
2. [Goal...] (#issue)
...

CRITICAL RULES:
- Commit and git push after EACH completed goal (not bulk!)
- After each goal, edit docs/wiki/Sprint-NN.md: change '- [ ]' to '- [x]'
  for that goal. Do NOT add new lines or create separate doc commits.
- npm run lint + npx tsc --noEmit + npm test + npm run build must pass
  before each push
- All files < 300 lines
```

### What MUST be in the prompt
- "commit+push after EACH goal" — without this, Claude Code batches everything
- Issue numbers (#16, #22) — enables git hook auto-checkoff
- Specific file paths when possible — reduces guessing
- "Do NOT add new lines" — prevents wiki pollution
- Quality gates (lint, tsc, test, build) — prevents broken pushes

---

## Git Hooks for Wiki Tracking

### Problem
Claude Code "forgets" to update the wiki, or adds new lines instead of checking off existing items.

### Solution: post-commit hook
```bash
# .githooks/post-commit
# Reads commit message → finds issue numbers (#16) → checks off matching goals
for ISSUE in $(echo "$COMMIT_MSG" | grep -oE '#[0-9]+' | tr -d '#'); do
  sed -i "s/- \[ \]\(.*#${ISSUE}\)/- [x]\1/" "$SPRINT_FILE"
done
git add "$SPRINT_FILE" && git commit --amend --no-edit --no-verify
```

**Setup:** `git config core.hooksPath .githooks`

**Requirement:** Sprint goals must include issue numbers. Commit messages must reference them.

---

## Wiki Structure

```
docs/wiki/
├── Sprint-Log.md          ← Summary page (newest first, links to sub-pages)
├── Sprint-01.md           ← Full details per sprint
├── Sprint-02.md
├── ...
├── Sprint-14.md
├── OpenClaw-Lessons.md    ← This file
└── Known-Issues.md        ← Optional
```

**Auto-sync:** GitHub Actions workflow pushes `docs/wiki/` to GitHub Wiki on every push:
```yaml
# .github/workflows/wiki-sync.yml
on:
  push:
    branches: [main]
    paths: ['docs/wiki/**']
jobs:
  sync:
    uses: Andrew-Chen-Wang/github-wiki-action@v4
    with: { path: docs/wiki/ }
```

---

## Smoke Testing with Mail Log

### Problem
Tests depending on email delivery (magic links, verification) are slow (1-2 min) and flaky.

### Solution
Log email URLs to a file. Tests read the file instead of polling email.

**In mail.ts:**
```typescript
function logMail(to: string, type: string, url: string) {
  if (!process.env.MAIL_LOG_FILE) return;
  appendFileSync(process.env.MAIL_LOG_FILE, 
    JSON.stringify({ to, type, url, timestamp: new Date().toISOString() }) + "\n");
}
```

**In docker-compose.yml:**
```yaml
volumes:
  - /tmp/ideate-logs:/tmp/ideate-logs   # directory mount, not file!
environment:
  - MAIL_LOG_FILE=/tmp/ideate-logs/mail.log
```

**Result:** 1.7 minutes → 11.5 seconds. Zero flakiness.

---

## External UI Review

Use ChatGPT with Operator (or any browser agent) as independent reviewer:

1. Create test accounts programmatically (register + verify via API + mail log)
2. Write detailed prompt: pages to visit, what to check, report format
3. Send prompt + credentials as file via WhatsApp
4. Agent navigates real staging like a user, takes screenshots
5. Create GitHub issues from findings
6. Feed issues into next sprint
7. Re-run review after fixes to verify

---

## Where OpenClaw Instructions Live

| What | Where | Why |
|------|-------|-----|
| Tool usage instructions | `TOOLS.md` | Always loaded in full, never truncated |
| Periodic checks, sprint lifecycle | `HEARTBEAT.md` | Loaded at every heartbeat |
| Sprint state tracking | `memory/sprint-state.json` | Machine-readable, unambiguous |
| Project context & history | `MEMORY.md` | May be truncated — no procedures here |
| Agent identity & behavior | `SOUL.md`, `AGENTS.md` | Personality and autonomy rules |
| Daily notes | `memory/YYYY-MM-DD.md` | Retrospectives, debug logs |

**Critical rule:** Procedures go in TOOLS.md or HEARTBEAT.md (always loaded). MEMORY.md is for context only.

---

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Claude Code commits everything at the end | "commit+push after EACH goal" in prompt |
| Wiki not updated | Git hook + issue numbers in commits |
| Post-sprint steps skipped | State machine (sprint-state.json) |
| OpenClaw asks permission to deploy | "Don't ask, just do" in AGENTS.md |
| Instructions in MEMORY.md ignored | Move to TOOLS.md (always loaded) |
| Checklist in separate file not opened | Inline steps in HEARTBEAT.md |
| Sprint goals based on inertia | Deep analysis between sprints |
| Agent says "done" but isn't | Smoke tests against real staging |
| UI bugs missed by developer agent | External review with ChatGPT Operator |
| Sprint-Log.md grows to 600+ lines | Sub-pages per sprint + summary overview |
| Claude Code uses wrong flags | Document in TOOLS.md: `--dangerously-skip-permissions` |
| Docker bind mount permission issues | Use directory mounts, not file mounts |

---

## Addendum: Don't Trust Heartbeats for Critical Workflows

**Problem:** The sprint state machine depends on heartbeats to advance. But heartbeats are every 30 min and the agent often skips steps because it gets "distracted" by other checks.

**Solution:** Add a dedicated cron job (every 10 min) that ONLY checks the sprint state and forces advancement. Separate from heartbeat — single responsibility.

```
Cron (10 min) → read sprint-state.json → if step pending → execute NOW
Heartbeat (30 min) → monitoring, health, wiki sync, server checks
```

**Lesson:** If a workflow is critical, don't bundle it with other checks. Give it its own trigger. The more independent triggers compete for attention, the more likely each one gets skipped.
