#!/usr/bin/env bash
# =====================================================
# SQLite backup for the School ERP (run on the Azure VM)
#
# Creates a timestamped, consistent copy of data/school.db
# and keeps the most recent N backups.
#
# Usage:
#   ./backup-db.sh                 # backs up to ./backups
#   BACKUP_DIR=/var/backups/erp ./backup-db.sh
#
# Cron (daily at 02:17 — off the round hour on purpose):
#   17 2 * * * /home/<user>/app/backend/scripts/backup-db.sh >> /home/<user>/erp-backup.log 2>&1
# =====================================================
set -euo pipefail

# Resolve paths relative to this script so cron's CWD doesn't matter.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_PATH="${DB_PATH:-$SCRIPT_DIR/../data/school.db}"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/../backups}"
KEEP="${KEEP:-14}"   # how many backups to retain

if [ ! -f "$DB_PATH" ]; then
    echo "[backup] ERROR: database not found at $DB_PATH" >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/school_$STAMP.db"

# Prefer the SQLite online-backup API (safe while the app is running).
# Fall back to a plain copy if the sqlite3 CLI isn't installed.
if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB_PATH" ".backup '$OUT'"
else
    cp "$DB_PATH" "$OUT"
fi

gzip -f "$OUT"
echo "[backup] wrote ${OUT}.gz"

# Rotate: keep only the newest $KEEP archives.
ls -1t "$BACKUP_DIR"/school_*.db.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
    rm -f "$old"
    echo "[backup] pruned $old"
done
