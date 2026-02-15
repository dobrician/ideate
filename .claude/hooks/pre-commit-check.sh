#!/bin/bash
# Pre-commit validation hook
# Reads JSON input from stdin, checks commit hygiene

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only check git commit commands
if ! echo "$CMD" | grep -q "git commit"; then
    exit 0
fi

ERRORS=""

# Check CHANGELOG.md was modified in staging
cd /home/dc/work/ideate
if ! git diff --cached --name-only 2>/dev/null | grep -q "CHANGELOG.md"; then
    # Check if any non-docs files are being committed
    if git diff --cached --name-only 2>/dev/null | grep -qvE "^(docs/|\.claude/|AGENTS\.md|README\.md)"; then
        ERRORS="$ERRORS\n⚠️  CHANGELOG.md not updated — update it before committing features/fixes"
    fi
fi

# Check Sprint-Log.md was updated recently
SPRINT_LOG="docs/wiki/Sprint-Log.md"
if [ -f "$SPRINT_LOG" ]; then
    if grep -q "IN PROGRESS" "$SPRINT_LOG" && ! git diff --cached --name-only 2>/dev/null | grep -q "Sprint-Log"; then
        ERRORS="$ERRORS\n📋 Sprint-Log.md not updated — check off completed tasks"
    fi
fi

if [ -n "$ERRORS" ]; then
    echo -e "$ERRORS" >&2
fi

exit 0  # Don't block, just warn
