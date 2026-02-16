# OpenClaw + Claude Code — Project Management Lessons

Hard-won lessons from building Ideate with autonomous AI agents. Everything here was learned the painful way — by failing first.

---

## 1. Claude Code Won't Remember — Write It Down

**Problem:** Claude Code has no memory between sessions. Instructions given verbally are forgotten.

**Solution:** All operational instructions go in files that are always loaded:
- `TOOLS.md` — tool-specific instructions (always in context)
- `HEARTBEAT.md` — periodic checks and sprint lifecycle rules
- `memory/sprint-state.json` — state machine for sprint flow
- `memory/sprint-checklists.md` — step-by-step checklists

**Rule:** If you tell Claude Code something important, it must end up in a file. "Mental notes" don't survive session restarts.

---

## 2. Incremental Commits, Not Bulk

**Problem:** Claude Code defaults to doing an entire sprint and committing everything at the end. No visibility into progress.

**Solution:** Sprint prompts MUST include:
```
"Commit and git push after EACH completed goal."
```

Without this explicit instruction, Claude Code will batch everything into one massive commit at the end.

---

## 3. Wiki Updates via Git Hooks, Not Manual Edits

**Problem:** Telling Claude Code to "update the wiki after each commit" results in:
- Separate doc-only commits (noise)
- Adding new lines instead of checking off existing checkboxes
- Forgetting to update entirely

**Solution:** A `post-commit` git hook that automatically:
1. Reads the commit message for issue numbers (`#16`, `#22`, etc.)
2. Finds matching `- [ ]` lines in the current sprint's wiki file
3. Changes them to `- [x]`
4. Amends the commit to include the wiki update

```bash
# .githooks/post-commit — auto-checks sprint goals
for ISSUE in $(echo "$COMMIT_MSG" | grep -oE '#[0-9]+' | tr -d '#'); do
  sed -i "s/- \[ \]\(.*#${ISSUE}\)/- [x]\1/" "$SPRINT_FILE"
done
git add "$SPRINT_FILE" && git commit --amend --no-edit --no-verify
```

**Setup:** `git config core.hooksPath .githooks`

---

## 4. Wiki Structure: Summary + Sub-Pages

**Problem:** A single Sprint-Log.md file grows to 600+ lines. Impossible to navigate.

**Solution:**
- `Sprint-Log.md` — overview with one-liner per sprint (newest first) + link to sub-page
- `Sprint-01.md` ... `Sprint-NN.md` — full details per sprint

**Auto-sync:** GitHub Actions workflow syncs `docs/wiki/*.md` to GitHub Wiki on every push:
```yaml
# .github/workflows/wiki-sync.yml
on:
  push:
    paths: ['docs/wiki/**']
jobs:
  sync:
    uses: Andrew-Chen-Wang/github-wiki-action@v4
    with:
      path: docs/wiki/
```

---

## 5. Sprint State Machine

**Problem:** Post-sprint steps (deploy, smoke tests, retrospective, analysis, next sprint goals) get skipped because the agent "forgets" or rushes to the next sprint.

**Solution:** A JSON state file that dictates what to do next:
```json
{
  "currentSprint": 13,
  "status": "complete",
  "postSprintDone": false,
  "analysisDone": false,
  "preSprintDone": false,
  "nextSprint": 14
}
```

At every heartbeat, the agent reads this file FIRST and acts based on state:
- `postSprintDone: false` → run post-sprint checklist
- `analysisDone: false` → launch deep analysis
- `preSprintDone: false` → define next sprint goals from analysis

The agent updates the file after each step. No step can be skipped.

---

## 6. Deep Analysis Between Sprints

**Problem:** Sprints get planned based on inertia ("what's next on the list?") instead of actual project needs.

**Solution:** After every sprint, launch Claude Code to analyze the entire codebase:
- Architecture, code quality, security, performance
- Test gaps, UX gaps, tech debt
- Missing features, competitive comparison
- Save to `docs/deep-analysis-report.md`

Next sprint goals come FROM the analysis, not from guessing.

---

## 7. Post-Sprint Checklist (Inline, Not Referenced)

**Problem:** Having a checklist in a separate file (`memory/sprint-checklists.md`) that says "follow this checklist" doesn't work — the agent skips the indirection.

**Solution:** Inline the FULL checklist directly in `HEARTBEAT.md`:
```markdown
POST-SPRINT (every single step, no skipping):
1. npm run lint && npx tsc --noEmit && npm test && npm run build
2. gh run list --limit 1 — CI must be green
3. docker compose up -d --build
4. npm run test:smoke — ALL must pass
5. Update Sprint-NN.md with Outcomes section
6. git commit + push
7. Write retrospective in memory/YYYY-MM-DD.md
8. Update MEMORY.md with lessons
9. Launch deep analysis
10. Define next sprint goals FROM analysis
11. Launch next sprint
```

---

## 8. Mail Log for Smoke Tests

**Problem:** Smoke tests that depend on email delivery (magic links, verification) are slow and flaky. SMTP delivery takes 10-60 seconds.

**Solution:** Log email URLs to a file instead of waiting for delivery:
```typescript
// In mail.ts — append URL to log file after sending
function logMail(to: string, type: string, url: string) {
  const logFile = process.env.MAIL_LOG_FILE || "";
  if (!logFile) return;
  appendFileSync(logFile, JSON.stringify({ to, type, url, timestamp: new Date().toISOString() }) + "\n");
}
```

Smoke tests read the URL directly from the log file instead of polling Gmail.

**Result:** Tests went from 1.7 minutes to 11.5 seconds. Zero flakiness.

**Docker setup:** Mount a shared directory (not file) for permissions:
```yaml
volumes:
  - /tmp/ideate-logs:/tmp/ideate-logs
environment:
  - MAIL_LOG_FILE=/tmp/ideate-logs/mail.log
```

---

## 9. Claude Code Prompt Template

The optimal sprint prompt structure:
```
Sprint N — [Title]. Do IN ORDER, commit+push after EACH:

1. [Goal with specific details, file paths, what to change]
2. [Goal...]
...

CRITICAL RULES:
- Commit and git push after EACH completed goal (not bulk!)
- After each goal, edit docs/wiki/Sprint-NN.md: change '- [ ]' to '- [x]'
  for that goal. Do NOT add new lines or create separate doc commits.
- npm run lint + npx tsc --noEmit + npm test + npm run build must pass
  before each push
- All files < 300 lines
```

**Key flags:** `claude -p "..." --max-turns 120 --dangerously-skip-permissions`

---

## 10. Don't Ask — Just Do

**Problem:** The agent asks "should I deploy?" or "want me to start the next sprint?" — wasting time and interrupting the human.

**Solution:** The agent should:
- Execute all post-sprint steps automatically
- Launch the next sprint without asking
- Only message the human when:
  - Something needs their decision
  - Tool usage > 80%
  - Server problems they need to address
  - Daily report (once per day)

---

## 11. Tool Instructions in TOOLS.md, Not MEMORY.md

**Problem:** MEMORY.md gets truncated in the agent's context window. Critical tool instructions (like `--dangerously-skip-permissions` for Claude Code) are lost.

**Solution:** All operational tool instructions go in `TOOLS.md`, which is always loaded in full. MEMORY.md is for context and history, not procedures.

---

## 12. UI/UX Review with ChatGPT Operator

**Problem:** The developer agent can't objectively evaluate UX — it wrote the code.

**Solution:** Use ChatGPT with Operator (browser agent) as an independent reviewer:
1. Create test accounts (register + verify programmatically)
2. Write a detailed prompt with test steps, pages to visit, what to look for
3. Send the prompt + credentials as a file
4. Agent navigates the real app like a user, takes screenshots, writes report
5. Create GitHub issues from findings
6. Feed issues into next sprint

Run the review twice: once to find issues, once after fixes to verify.

---

## Summary

| Problem | Solution |
|---------|----------|
| Agent forgets instructions | Write them in always-loaded files (TOOLS.md, HEARTBEAT.md) |
| Bulk commits, no visibility | "commit+push after EACH goal" in prompt |
| Wiki not updated | Git post-commit hook auto-checks goals |
| Sprint steps skipped | State machine (sprint-state.json) |
| Sprints planned by inertia | Deep analysis between sprints |
| Checklist ignored | Inline in HEARTBEAT.md, not referenced |
| Slow/flaky email tests | Mail log file, read directly |
| Agent asks too much | "Don't ask, just do" rule |
| UX blind spots | External ChatGPT Operator review |
