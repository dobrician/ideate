#!/bin/bash
# Sprint Runner — Deterministic orchestrator
# Runs via systemd timer every 10 minutes
# Reads state, verifies evidence, launches next step
# The AI agent is a WORKER, not the orchestrator

set -euo pipefail

STATE_FILE="/home/dc/.openclaw/workspace/memory/sprint-state.json"
REPO="/home/dc/work/ideate"
LOG="/tmp/sprint-runner.log"
LOCK="/tmp/sprint-runner.lock"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >> "$LOG"; }

# Prevent concurrent runs
if [ -f "$LOCK" ]; then
  LOCK_AGE=$(( $(date +%s) - $(stat -c %Y "$LOCK") ))
  if [ "$LOCK_AGE" -lt 3600 ]; then
    log "SKIP: lock exists (${LOCK_AGE}s old)"
    exit 0
  fi
  log "WARN: stale lock (${LOCK_AGE}s), removing"
  rm -f "$LOCK"
fi

cleanup() { rm -f "$LOCK"; }
trap cleanup EXIT
touch "$LOCK"

# Read state
[ ! -f "$STATE_FILE" ] && { log "No state file"; exit 0; }

STATUS=$(jq -r '.status' "$STATE_FILE")
POST_DONE=$(jq -r '.postSprintDone' "$STATE_FILE")
ANALYSIS_DONE=$(jq -r '.analysisDone' "$STATE_FILE")
PRE_DONE=$(jq -r '.preSprintDone' "$STATE_FILE")
CURRENT=$(jq -r '.currentSprint' "$STATE_FILE")
NEXT=$(jq -r '.nextSprint' "$STATE_FILE")
SESSION_ID=$(jq -r '.sessionId // empty' "$STATE_FILE")

# Only act on completed sprints
if [ "$STATUS" = "running" ]; then
  # Check if Claude Code session is still alive
  if [ -n "$SESSION_ID" ]; then
    ALIVE=$(ps aux | grep -c "claude.*Sprint" || true)
    if [ "$ALIVE" -eq 0 ]; then
      log "ALERT: Sprint $CURRENT session dead, no claude process found"
      # Don't auto-restart — mark for investigation
    fi
  fi
  exit 0
fi

[ "$STATUS" != "complete" ] && exit 0

cd "$REPO"

# ============================================
# STEP 1: Post-sprint
# ============================================
if [ "$POST_DONE" = "false" ]; then
  log "STEP: post-sprint for Sprint $CURRENT"

  # Evidence check: CI must be green
  CI_STATUS=$(gh run list --limit 1 --json conclusion -q '.[0].conclusion' 2>/dev/null || echo "unknown")
  if [ "$CI_STATUS" != "success" ]; then
    log "BLOCKED: CI not green ($CI_STATUS), cannot post-sprint"
    exit 1
  fi

  # Deploy
  log "Deploying..."
  docker compose up -d --build >> "$LOG" 2>&1
  sleep 15

  # Smoke tests — EVIDENCE-BASED gate
  log "Running smoke tests..."
  SMOKE_RESULT=$(npm run test:smoke 2>&1 | tail -1)
  if ! echo "$SMOKE_RESULT" | grep -q "passed"; then
    log "BLOCKED: smoke tests failed: $SMOKE_RESULT"
    exit 1
  fi
  log "Smoke tests: $SMOKE_RESULT"

  # Update state — only after evidence passes
  jq '.postSprintDone = true' "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
  log "DONE: post-sprint complete"
  exit 0  # One step per run
fi

# ============================================
# STEP 2: Analysis
# ============================================
if [ "$ANALYSIS_DONE" = "false" ]; then
  log "STEP: analysis for Sprint $NEXT"

  # Check if analysis is already running
  ANALYSIS_PID=$(pgrep -f "claude.*analysis.*Sprint" || true)
  if [ -n "$ANALYSIS_PID" ]; then
    log "SKIP: analysis already running (pid $ANALYSIS_PID)"
    exit 0
  fi

  # Launch Claude Code for analysis
  cd "$REPO"
  claude -p "Quick analysis for Sprint $NEXT. Run: gh issue list --state open, npm test with coverage summary, npx tsc --noEmit. Check open issues, test gaps, production readiness. Write 6-8 Sprint $NEXT goals to docs/deep-analysis-report.md. Be brief and focused." \
    --max-turns 20 --dangerously-skip-permissions >> "$LOG" 2>&1

  # Evidence: report file must exist and be recent
  if [ -f "$REPO/docs/deep-analysis-report.md" ]; then
    REPORT_AGE=$(( $(date +%s) - $(stat -c %Y "$REPO/docs/deep-analysis-report.md") ))
    if [ "$REPORT_AGE" -lt 600 ]; then
      jq '.analysisDone = true' "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
      log "DONE: analysis complete (report ${REPORT_AGE}s old)"
    else
      log "WARN: analysis report too old (${REPORT_AGE}s), not advancing"
    fi
  else
    log "WARN: no analysis report generated"
  fi
  exit 0
fi

# ============================================
# STEP 3: Pre-sprint (define goals + launch)
# ============================================
if [ "$PRE_DONE" = "false" ]; then
  log "STEP: pre-sprint for Sprint $NEXT"

  # Check if sprint is already running
  SPRINT_PID=$(pgrep -f "claude.*Sprint.*$NEXT" || true)
  if [ -n "$SPRINT_PID" ]; then
    log "SKIP: Sprint $NEXT already running (pid $SPRINT_PID)"
    exit 0
  fi

  # Read analysis report for goals
  if [ ! -f "$REPO/docs/deep-analysis-report.md" ]; then
    log "BLOCKED: no analysis report, cannot define goals"
    jq '.analysisDone = false' "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
    exit 1
  fi

  # Extract goals from report and create sprint doc
  # This part uses Claude Code to create the sprint wiki page and launch
  cd "$REPO"
  nohup setsid claude -p "Read docs/deep-analysis-report.md. Create docs/wiki/Sprint-$(printf '%02d' $NEXT).md with the goals as checkboxes. Update docs/wiki/Sprint-Log.md with a new entry at the top. Commit and push with message 'docs: Sprint $NEXT goals'. Then execute the sprint goals: do each one in order, commit+push after EACH goal. After each goal, edit docs/wiki/Sprint-$(printf '%02d' $NEXT).md: change '- [ ]' to '- [x]' for that goal. Do NOT add new lines. npm run lint + npx tsc --noEmit + npm test + npm run build must pass before each push. All files < 300 lines." \
    --max-turns 120 --dangerously-skip-permissions >> "$LOG" 2>&1 &

  SPRINT_PID=$!
  log "Launched Sprint $NEXT (pid $SPRINT_PID)"

  # Update state
  jq ".status = \"running\" | .currentSprint = $NEXT | .preSprintDone = true | .postSprintDone = false | .analysisDone = false | .nextSprint = $(($NEXT + 1)) | .sessionId = \"pid-$SPRINT_PID\"" \
    "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

  log "DONE: Sprint $NEXT launched"
  exit 0
fi

log "All steps complete, nothing to do"
