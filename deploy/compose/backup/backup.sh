#!/bin/sh
# Periodic logical backups of both databases (custom format, restorable with pg_restore),
# plus the cluster globals (roles). Old backups are deleted after BACKUP_KEEP_DAYS.
# Copy the backups volume off the host (rclone, restic, an object store) – a backup on the
# same disk only protects against mistakes, not against losing the machine.
set -eu
: "${BACKUP_KEEP_DAYS:=14}"
: "${BACKUP_INTERVAL_SECONDS:=86400}"

while true; do
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  dir="/backups/$stamp"
  mkdir -p "$dir"
  echo "[backup] $stamp starting"
  pg_dumpall --globals-only > "$dir/globals.sql"
  pg_dump -Fc -d sjodur   -f "$dir/sjodur.dump"
  pg_dump -Fc -d keycloak -f "$dir/keycloak.dump"
  find /backups -mindepth 1 -maxdepth 1 -type d -mtime +"$BACKUP_KEEP_DAYS" -exec rm -rf {} +
  echo "[backup] $stamp done: $(du -sh "$dir" | cut -f1)"
  sleep "$BACKUP_INTERVAL_SECONDS"
done
