# Sprint Orchestrator — Evolution & Architecture

The story of how we went from "AI agent remembers to do things" to a deterministic orchestration system.

---

## The Problem

We run software sprints using two AI agents:
- **OpenClaw (Tibi)** — project manager, runs 24/7 on WhatsApp
- **Claude Code** — developer, launched as background process, writes code

The sprint lifecycle has 4 phases:
1. **Sprint** — Claude Code writes code, commits, pushes
2. **Post-sprint** — deploy, smoke tests, update docs, retrospective
3. **Analysis** — Claude Code analyzes codebase, identifies priorities
4. **Pre-sprint** — define goals from analysis, launch next sprint

**The critical failure:** OpenClaw kept forgetting to advance between phases. Post-sprint would finish, then... nothing. The agent got "distracted" by heartbeat checks, user messages, or simply didn't act on its own state file.

---

## Iteration 1: Instructions in HEARTBEAT.md

**Approach:** Write the full checklist in HEARTBEAT.md. Every 30 minutes at heartbeat, the agent reads it and acts.

**Result:** ~50% reliability. The agent would do post-sprint but skip analysis. Or do analysis but forget to launch the next sprint. Long checklists lose attention — the agent focuses on the first few items and drops the rest.

**Lesson:** Instructions ≠ execution. Writing "do this" in a file doesn't mean the agent will do it.

---

## Iteration 2: State Machine (sprint-state.json)

**Approach:** A JSON file tracking exactly which step is pending:
```json
{
  "currentSprint": 17,
  "status": "complete",
  "postSprintDone": true,
  "analysisDone": false,
  "preSprintDone": false,
  "nextSprint": 18
}
```

The agent reads this at each heartbeat. Only one step can be pending. No skipping.

**Result:** ~60% reliability. Better than checklists — the agent knows exactly what to do. But still depends on the agent actually reading and acting on it during heartbeats. Heartbeats are every 30 min, and the agent often prioritizes other checks.

**Lesson:** State tracking helps, but the agent is still the executor AND the scheduler. It's like asking someone with amnesia to be their own alarm clock.

---

## Iteration 3: Cron Job (OpenClaw cron)

**Approach:** A dedicated cron job every 10 minutes that injects a system message: "Read sprint-state.json. If any step is pending, execute it NOW."

**Result:** ~70% reliability. More frequent triggers help. But still fails because:
- The message lands in a conversational session — context, other messages, and prompt drift affect execution
- Not idempotent — can re-run partially completed steps
- Race conditions between heartbeat, cron, and manual commands
- "Done" is determined by agent self-report, not machine verification

**What Codex said about this approach:**
> "Not sustainable beyond light usage. This is a brittle 'LLM as scheduler' pattern. The agent should be a WORKER, not the orchestrator."

**Lesson:** Even with triggers, an LLM is unreliable as a scheduler. It might ignore the message, misinterpret the state, or get interrupted.

---

## Iteration 4: Deterministic Script (sprint-runner.sh) ✅ Current

**Approach:** Move the control plane OUT of the AI agent. A bash script runs via systemd timer every 10 minutes:

```
systemd timer (10 min)
    → sprint-runner.sh
        → reads sprint-state.json
        → verifies EVIDENCE (CI green? smoke tests pass? report exists?)
        → launches exactly ONE step
        → updates state ONLY after evidence passes
        → exits
```

**Key design decisions:**

### 1. One step per run
Each invocation does exactly one thing. Post-sprint OR analysis OR launch — never multiple. This prevents partial failures from corrupting state.

### 2. Evidence-based gates
State advances only when machine-verifiable evidence exists:
- Post-sprint: CI green + smoke tests pass + deploy healthy
- Analysis: report file exists and is recent (<10 min old)
- Pre-sprint: sprint process launched with PID

No "the agent said it's done" — actual verification.

### 3. Lock file with age check
Prevents concurrent runs. Stale locks (>1 hour) are auto-cleaned.

### 4. Agent as worker
Claude Code is launched by the script, not by OpenClaw. OpenClaw becomes a monitor and communicator — reports progress to the human, handles feedback — but doesn't decide when to advance the pipeline.

### 5. Heartbeat becomes monitoring only
OpenClaw's heartbeat checks server health, wiki sync, disk space. It does NOT control sprint advancement.

### Architecture

```
┌─────────────────┐
│  systemd timer   │  ← Deterministic, runs every 10 min
│  (10 min cycle)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ sprint-runner.sh │  ← Reads state, checks evidence, launches ONE step
│  (bash script)   │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────────┐
│Evidence│ │ Claude Code │  ← Worker: executes scoped task, returns result
│ checks │ │  (worker)   │
└────────┘ └────────────┘

┌─────────────────┐
│    OpenClaw      │  ← Monitor: reports to human, handles feedback
│  (heartbeat)     │     Does NOT control sprint advancement
└─────────────────┘
```

### Files

| File | Purpose |
|------|---------|
| `scripts/sprint-runner.sh` | Orchestrator script |
| `scripts/sprint-runner.service` | systemd service unit |
| `scripts/sprint-runner.timer` | systemd timer (10 min) |
| `memory/sprint-state.json` | State machine |
| `/tmp/sprint-runner.log` | Execution log |
| `/tmp/sprint-runner.lock` | Concurrency lock |

### State transitions

```
Sprint Running → (Claude Code exits)
    → status: "complete", postSprintDone: false

Post-sprint → (CI green + smoke pass + deploy OK)
    → postSprintDone: true

Analysis → (report file exists, <10 min old)
    → analysisDone: true

Pre-sprint → (Claude Code launched with PID)
    → status: "running", currentSprint: N+1
```

---

## Reliability comparison

| Approach | Reliability | Failure mode |
|----------|------------|--------------|
| Instructions in file | ~50% | Agent skips steps, loses attention |
| State machine + heartbeat | ~60% | Agent reads state but doesn't act |
| Cron into main session | ~70% | Context drift, race conditions |
| **Deterministic script** | **~95%** | **Script crash, disk full (recoverable)** |

---

## Remaining 5% failure modes

1. **Script crash** — systemd auto-restarts on next timer tick
2. **Disk full** — can't write state → stuck (monitored by heartbeat)
3. **Claude Code hangs** — lock timeout (1 hour) eventually clears
4. **Analysis produces garbage** — no quality gate on report content (future improvement: validate report has goals section)
5. **Network down** — CI check fails, blocks post-sprint (correct behavior)

---

## Lessons for other OpenClaw projects

1. **Never use an LLM as a scheduler.** LLMs forget, get distracted, and hallucinate completion.
2. **Separate workers from orchestrators.** The AI writes code. A script decides when.
3. **Gate on evidence, not self-report.** "Tests pass" means `npm test` exit code 0, not "the agent said tests pass."
4. **One step per cycle.** Prevent cascading failures.
5. **Lock files prevent races.** Simple but effective.
6. **Start simple, evolve when it breaks.** We didn't need Temporal. We needed a bash script.
