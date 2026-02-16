#!/usr/bin/env bash
# install-backup-timer.sh — Install systemd timer for daily SQLite backups
# Usage: sudo ./scripts/install-backup-timer.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cp "$SCRIPT_DIR/ideate-backup.service" /etc/systemd/system/
cp "$SCRIPT_DIR/ideate-backup.timer" /etc/systemd/system/

systemctl daemon-reload
systemctl enable --now ideate-backup.timer

echo "Timer installed. Status:"
systemctl status ideate-backup.timer --no-pager
echo ""
echo "Next run:"
systemctl list-timers ideate-backup.timer --no-pager
