#!/usr/bin/env bash

set -euo pipefail

database="${1:-naude_test}"

if [[ "$database" != "naude" && "$database" != "naude_test" ]]; then
  printf 'UNKNOWN: choose naude or naude_test.\n' >&2
  exit 2
fi

state_dir="${NAUDE_BACKUP_STATE_DIR:-$HOME/.local/state/naude-backups}"
backup_root="${NAUDE_BACKUP_ROOT:-$HOME/naude-db-backups}"
state_file="$state_dir/$database.last-success"

if [[ ! -f "$state_file" ]]; then
  printf 'UNHEALTHY: no successful backup recorded for %s.\n' "$database"
  exit 1
fi

last_success="$(cat -- "$state_file")"

if [[ ! "$last_success" =~ ^[0-9]{1,10}$ ]]; then
  printf 'UNKNOWN: invalid timestamp in %s.\n' "$state_file" >&2
  exit 2
fi

now="$(date -u +%s)"
age_seconds=$((now - 10#$last_success))
max_age_seconds=$((26 * 60 * 60))

if (( age_seconds < 0 )); then
  printf 'UNKNOWN: backup timestamp is in the future; check the clock.\n' >&2
  exit 2
fi

age_minutes=$((age_seconds / 60))

if (( age_seconds > max_age_seconds )); then
  printf 'UNHEALTHY: last successful %s backup was %s minutes ago.\n' \
    "$database" "$age_minutes"
  exit 1
fi

if [[ ! -d "$backup_root" ]]; then
  printf 'UNHEALTHY: backup directory is missing: %s\n' "$backup_root" >&2
  exit 1
fi

shopt -s nullglob
candidates=("$backup_root/$database-"*)
backup_dir=""

for candidate in "${candidates[@]}"; do
  if [[ -d "$candidate" ]]; then
    backup_dir="$candidate"
  fi
done

if [[ -z "$backup_dir" ]]; then
  printf 'UNHEALTHY: no completed backup directory found for %s.\n' \
    "$database" >&2
  exit 1
fi

backup_name="${backup_dir##*/}"

if [[ ! "$backup_name" =~ -([0-9]{8})-([0-9]{6})\. ]]; then
  printf 'UNKNOWN: cannot read backup date from %s.\n' "$backup_name" >&2
  exit 2
fi

backup_day="${BASH_REMATCH[1]}"
backup_time="${BASH_REMATCH[2]}"

if ! backup_created="$(date -u -d \
  "${backup_day:0:4}-${backup_day:4:2}-${backup_day:6:2} ${backup_time:0:2}:${backup_time:2:2}:${backup_time:4:2}" \
  +%s)"; then
  printf 'UNKNOWN: invalid date in backup name %s.\n' "$backup_name" >&2
  exit 2
fi

backup_age=$((now - backup_created))

if (( backup_age < 0 )); then
  printf 'UNKNOWN: backup directory date is in the future.\n' >&2
  exit 2
fi

if (( backup_age > max_age_seconds )); then
  printf 'UNHEALTHY: newest backup archive is older than 26 hours: %s\n' \
    "$backup_name" >&2
  exit 1
fi
for name in database.dump SHA256SUMS archive-list.txt restore-check.txt; do
  if [[ ! -s "$backup_dir/$name" ]]; then
    printf 'UNHEALTHY: backup file is missing or empty: %s\n' \
      "$backup_dir/$name" >&2
    exit 1
  fi
done

if ! (
  cd -- "$backup_dir"
  sha256sum --check --status SHA256SUMS
); then
  printf 'UNHEALTHY: backup checksum verification failed: %s\n' \
    "$backup_dir" >&2
  exit 1
fi

printf 'HEALTHY: last successful %s backup was %s minutes ago.\n' \
  "$database" "$age_minutes"
