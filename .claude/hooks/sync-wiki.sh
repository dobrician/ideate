#!/bin/bash
# Sync docs/wiki/ to GitHub Wiki repo after changes
# Called by Claude Code hooks (PostToolUse on git push, Stop, TaskCompleted)

WIKI_DIR="/tmp/ideate.wiki"
DOCS_DIR="/home/dc/work/ideate/docs/wiki"

# Ensure wiki repo exists
if [ ! -d "$WIKI_DIR" ]; then
    git clone https://github.com/dobrician/ideate.wiki.git "$WIKI_DIR" 2>/dev/null
    if [ $? -ne 0 ]; then
        echo "Failed to clone wiki repo" >&2
        exit 0  # Don't block the main task
    fi
fi

# Pull latest
cd "$WIKI_DIR" && git pull --quiet 2>/dev/null

# Copy and check for changes
cp "$DOCS_DIR"/*.md "$WIKI_DIR/" 2>/dev/null
cd "$WIKI_DIR" && git add -A

if ! git diff --cached --quiet 2>/dev/null; then
    git commit -m "docs: sync wiki from project" --quiet 2>/dev/null
    git push --quiet 2>/dev/null
    echo "📋 Wiki synced to GitHub" >&2
fi

exit 0
