#!/bin/bash
# Post-sprint automation — run this after every sprint completion
# Usage: ./scripts/post-sprint.sh <sprint_number>

set -e
SPRINT=$1
REPO="/home/dc/work/ideate"
WIKI="/tmp/ideate.wiki"

if [ -z "$SPRINT" ]; then
  echo "Usage: $0 <sprint_number>"
  exit 1
fi

echo "=== POST-SPRINT $SPRINT CHECKLIST ==="

echo "1/8 — Lint..."
cd $REPO && npm run lint

echo "2/8 — Type check..."
npx tsc --noEmit

echo "3/8 — Unit tests..."
npm test

echo "4/8 — Build..."
npm run build

echo "5/8 — CI status..."
gh run list --limit 1

echo "6/8 — Deploy to staging..."
docker compose up -d --build

echo "7/8 — Waiting for staging..."
sleep 15

echo "8/8 — Smoke tests..."
npm run test:smoke

echo ""
echo "=== AUTOMATED CHECKS PASSED ==="
echo ""
echo "MANUAL STEPS REMAINING (agent must do these):"
echo "  □ Update Sprint-Log.md with Outcomes section"
echo "  □ Git commit + push outcomes"
echo "  □ Write retrospective in memory/YYYY-MM-DD.md"
echo "  □ Update MEMORY.md with lessons"
echo "  □ Launch Claude Code DEEP ANALYSIS (docs/deep-analysis-report.md)"
echo "  □ Read analysis report"
echo "  □ Define Sprint $((SPRINT+1)) goals FROM the analysis"
echo "  □ Document goals in Sprint-Log.md"
echo "  □ Git commit + push goals"
echo "  □ Launch Sprint $((SPRINT+1))"
