#!/usr/bin/env bash
# AgentFlow AI — Database Backup Snapshot (W20-T2)
#
# Performs a logical dump of the production Postgres database and uploads it to
# object storage (Supabase Storage bucket `backups`, or S3-compatible via
# AWS_/SUPABASE_ env). Records the run in the `backup_jobs` table via the
# /api/cron/backup monitor (freshness) — this script is the actual dump; the
# cron is the watchdog.
#
# RPO target: hourly logical dump (set this on a cron / scheduler).
# RTO target: restore from latest dump (~15 min for this size).
#
# Required env:
#   DATABASE_URL or (PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE)
#   BACKUP_DESTINATION   e.g. "supabase-storage" or "s3"
#   BACKUP_BUCKET        e.g. "backups"
#   RPO_TARGET_MINUTES   e.g. 60
#   RTO_TARGET_MINUTES   e.g. 15
#
# Optional (Supabase Storage upload):
#   SUPABASE_STORAGE_URL, SUPABASE_SERVICE_ROLE_KEY
# Optional (S3 upload): AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log() { printf '\n▶ %s\n' "$*"; }
fail() { echo "✗ $*" >&2; exit 1; }

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_FILE="/tmp/agentflow-backup-${TIMESTAMP}.sql.gz"
JOB_TYPE="db_snapshot_real"
RPO="${RPO_TARGET_MINUTES:-60}"
RTO="${RTO_TARGET_MINUTES:-15}"

command -v pg_dump >/dev/null 2>&1 || fail "pg_dump not found in PATH"
command -v gzip >/dev/null 2>&1 || fail "gzip not found in PATH"

log "Dumping database -> ${DUMP_FILE}"
if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_dump --format=plain --no-owner --no-privileges "${DATABASE_URL}" | gzip > "${DUMP_FILE}" \
    || fail "pg_dump failed"
else
  pg_dump --format=plain --no-owner --no-privileges \
    "postgres://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}" | gzip > "${DUMP_FILE}" \
    || fail "pg_dump failed"
fi

SIZE_BYTES="$(stat -c%s "${DUMP_FILE}" 2>/dev/null || echo 0)"
log "Dump complete (${SIZE_BYTES} bytes)"

DEST="${BACKUP_DESTINATION:-supabase-storage}"
case "$DEST" in
  supabase-storage)
    command -v supabase >/dev/null 2>&1 || fail "supabase CLI required for storage upload"
    log "Uploading to Supabase Storage bucket '${BACKUP_BUCKET:-backups}'"
    supabase storage upload "${BACKUP_BUCKET:-backups}" "${DUMP_FILE}" "db/${TIMESTAMP}.sql.gz" \
      || fail "storage upload failed"
    ;;
  s3)
    command -v aws >/dev/null 2>&1 || fail "aws CLI required for S3 upload"
    log "Uploading to s3://${BACKUP_BUCKET:-backups}/db/${TIMESTAMP}.sql.gz"
    aws s3 cp "${DUMP_FILE}" "s3://${BACKUP_BUCKET:-backups}/db/${TIMESTAMP}.sql.gz" \
      || fail "s3 upload failed"
    ;;
  *)
    log "BACKUP_DESTINATION='${DEST}' — skipping upload (local dump only at ${DUMP_FILE})"
    ;;
esac

# Record success in the backup_jobs table via the monitor endpoint is handled
# by /api/cron/backup; here we just log the artifact location.
log "Backup artifact: ${DUMP_FILE}"
log "RPO target: ${RPO}m | RTO target: ${RTO}m"
log "Backup snapshot complete"
