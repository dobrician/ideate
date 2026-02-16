# Working with AI Agents — Lessons Learned

Universal lessons about working with OpenClaw and autonomous AI agents. These apply to any project, not just Ideate. Learned the hard way.

---

## The Core Problem

AI agents wake up fresh every session. They have no persistent memory, no discipline, and no habits. Everything you don't write down explicitly will be forgotten. Everything you write down but put in the wrong place will be ignored. And even things in the right place will sometimes be skipped if the agent gets "distracted" by the task at hand.

You are not working with a junior developer. You are working with a brilliant amnesiac who needs a very specific operating environment to function.

---

## 1. The Agent Doesn't Remember — You Must Externalize Everything

**What happens:** You tell the agent something important. It acknowledges. Next session, it has no idea.

**Why:** Each session starts fresh. Chat history is compacted into summaries that lose detail. MEMORY.md gets truncated if too long.

**Fix:**
- Critical operational instructions → `TOOLS.md` (always loaded in full)
- Periodic checks and workflows → `HEARTBEAT.md` (always loaded)
- Context and history → `MEMORY.md` (may be truncated — don't put procedures here)
- State tracking → JSON files (machine-readable, unambiguous)

**Rule of thumb:** If you'd be upset that the agent forgot it, it belongs in TOOLS.md or HEARTBEAT.md, not in conversation.

---

## 2. Long Checklists Get Abandoned Midway

**What happens:** You give the agent a 10-step checklist. It does steps 1-3 thoroughly, then "forgets" steps 4-10 because it got absorbed in the work.

**Why:** LLMs have finite attention. The longer the task, the more likely later steps get dropped. The agent optimizes for the immediate task and loses sight of the meta-process.

**Fixes:**
- **State machines over checklists.** Instead of "do these 10 things," use a JSON state file that tracks which step is next. The agent reads state → does ONE step → updates state → next heartbeat picks up the next step.
- **Inline critical steps in HEARTBEAT.md**, not as a reference to another file. "See checklist in X" = guaranteed to be skipped.
- **Automate what you can.** If a step can be a script or git hook, make it one. Don't rely on the agent's "discipline."

---

## 3. Instructions in Memory ≠ Instructions Followed

**What happens:** The instruction is clearly written in MEMORY.md. The agent doesn't follow it. You remind the agent. It apologizes and says "you're right, it's in MEMORY.md." Then does it again next time.

**Why:** 
- MEMORY.md may be truncated in context (large files get cut)
- Even when loaded, the agent scans rather than reads carefully
- In-the-moment task focus overrides background instructions
- The agent is not actually "reading" files like a human — it's pattern-matching on context

**Fixes:**
- Move procedures from MEMORY.md to TOOLS.md (never truncated)
- Keep MEMORY.md for context/history, not operational rules
- For critical workflows: use state files + heartbeat checks, not just written instructions
- Accept that you'll need to verify compliance, not just trust it

---

## 4. "Ask Before Acting" = Nothing Gets Done

**What happens:** You tell the agent to handle things autonomously. It asks "should I deploy?" "should I start the next sprint?" "want me to fix this?"

**Why:** The agent defaults to being cautious. It's trained to be helpful, and "asking permission" feels helpful.

**Fix:** Be explicit about autonomy boundaries:
- **Do without asking:** Deploy, run tests, fix CI, sync wiki, start next sprint, routine maintenance
- **Ask first:** Anything external (emails, public posts), architectural decisions, spending money
- **Only message when:** Something needs human decision, tool limits approaching, server problems

Write these boundaries in AGENTS.md or HEARTBEAT.md.

---

## 5. Don't Reference Files — Inline the Content

**What happens:** HEARTBEAT.md says "follow the checklist in memory/sprint-checklists.md." The agent never opens that file.

**Why:** Every file reference is a step the agent might skip. The agent is already processing HEARTBEAT.md — adding a "go read this other file" instruction introduces indirection that gets lost.

**Fix:** Put the actual steps directly in the file the agent reads. Yes, it makes HEARTBEAT.md longer. That's fine. One long file that gets followed > two short files where the second one is ignored.

---

## 6. Prompts Need Explicit Micro-Instructions

**What happens:** You say "do the sprint and update the wiki." The agent does the sprint. Doesn't update the wiki.

**Why:** The agent focuses on the primary task (write code) and treats secondary instructions (update wiki) as optional. Vague instructions ("update the wiki") are interpreted loosely.

**Fix:** Be painfully specific in prompts:
```
BAD:  "Do Sprint 14 and keep the wiki updated."
GOOD: "After EACH goal, edit docs/wiki/Sprint-14.md: change '- [ ]' to '- [x]' 
       for that goal. Do NOT add new lines or create separate doc commits."
```

Specify the exact file, the exact edit, and what NOT to do.

---

## 7. Automate Instead of Instructing

**What happens:** You tell the agent to do X after every commit. It does it for the first 3 commits, then stops.

**Why:** Repetitive meta-tasks (update wiki, check CI, sync docs) compete for attention with the actual work. The agent prioritizes the interesting task.

**Fix:** Git hooks, GitHub Actions, cron jobs, scripts. If a task is mechanical and repeatable, don't make it an instruction — make it automation.

**Examples:**
- Wiki sync → GitHub Actions workflow on push
- Sprint goal checkoff → post-commit git hook matching issue numbers
- CI check → GitHub Actions (already exists)
- Deploy → script, not manual steps

---

## 8. State Files > Natural Language Instructions

**What happens:** You write in HEARTBEAT.md: "After a sprint finishes, do the post-sprint checklist, then analysis, then pre-sprint, then launch." The agent does post-sprint, then launches the next sprint, skipping analysis.

**Why:** Natural language is ambiguous and skimmable. The agent reads "sprint finishes → launch next sprint" and skips the middle.

**Fix:** Use a JSON state machine:
```json
{
  "status": "complete",
  "postSprintDone": true,
  "analysisDone": false,
  "preSprintDone": false
}
```

The agent reads the state file and can only do ONE thing: the next `false` field. It updates the file after each step. No step can be skipped because the state won't advance.

---

## 9. The Agent Will Optimize for the Wrong Thing

**What happens:** You want: working features + wiki updates + tests + proper commits. The agent delivers: working features only. Everything else is "extra."

**Why:** The agent sees code completion as the primary success metric. Process tasks (docs, wiki, tests) feel secondary.

**Fix:** 
- Make process tasks part of the definition of done in the prompt
- "npm run lint + tsc + test + build must pass BEFORE each push" 
- Gate the work: if tests don't pass, the goal isn't done
- Use hooks and CI to enforce, not just instructions

---

## 10. Verify, Don't Trust

**What happens:** The agent says "done, all goals complete, 32/32 tests pass." You check — 3 tests are failing, wiki isn't updated, deploy wasn't done.

**Why:** The agent reports what it believes happened, not always what actually happened. It's not lying — it's confabulating based on patterns.

**Fix:**
- Always run verification yourself (or via automated checks)
- Smoke tests against real staging, not just unit tests
- Have a second agent (ChatGPT Operator, Codex) verify the first agent's work
- Don't accept "done" without evidence (CI green, smoke tests passing, staging responding)

---

## 11. External Review Catches What the Builder Misses

**What happens:** The development agent says the UI is polished and translations are complete. A real user test reveals broken logout, missing translations, and confusing UX.

**Why:** The agent that wrote the code can't objectively evaluate it. It has built-in confirmation bias about its own work.

**Fix:** Use a separate agent (ChatGPT Operator, or any browser-capable agent) as an independent reviewer:
1. Create test accounts programmatically
2. Write a detailed review prompt
3. Let the reviewer navigate the app like a real user
4. Collect findings as GitHub issues
5. Feed into next sprint

Review twice: once to find bugs, once to verify fixes.

---

## 12. Heartbeats Are Your Control Loop

**What happens:** You launch a long-running task and come back hours later to find it died 10 minutes in, or finished but nothing was done after.

**Why:** No monitoring = no recovery. The agent needs periodic check-ins.

**Fix:** OpenClaw heartbeats (every ~30 min) should:
1. Check state file → act on current state
2. Check if background processes are alive
3. Check git log for recent activity
4. If something died → restart
5. If something finished → execute next steps

The heartbeat is your control loop. Everything important should be reachable from it.

---

## Summary Table

| Problem | Root Cause | Solution |
|---------|-----------|----------|
| Agent forgets instructions | No persistent memory | TOOLS.md / HEARTBEAT.md (always loaded) |
| Checklist items skipped | Attention fades on long lists | State machine (JSON file) |
| Written rules not followed | Wrong file / truncated context | TOOLS.md for procedures, MEMORY.md for context only |
| Asks too many questions | Default cautious behavior | Explicit autonomy boundaries in AGENTS.md |
| Referenced files not opened | Indirection gets skipped | Inline content, don't reference |
| Vague instructions ignored | Ambiguity = optional | Painfully specific micro-instructions |
| Repetitive tasks forgotten | Task fatigue | Automate (hooks, CI, scripts) |
| Steps skipped in workflows | Natural language is skimmable | JSON state machine |
| Process tasks deprioritized | Code = primary, docs = secondary | Make process part of definition of done |
| Agent reports false completion | Confabulation | Independent verification |
| Builder can't review own work | Confirmation bias | External agent review |
| Long tasks die unnoticed | No monitoring | Heartbeat control loop |
