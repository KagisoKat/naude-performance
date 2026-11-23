#!/usr/bin/env bash

set -euo pipefail
umask 077

database="${1:-naude_test}"

if [[ "$database" != "naude" && "$database" != "naude_test" ]]; then
  printf 'Choose naude or naude_test.\n' >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
state_dir="$HOME/.local/state/naude-backups"

mkdir -p "$state_dir" "$HOME/.cache"

exec 9>"$HOME/.cache/naude-backup-due.lock"
flock -x 9

state_file="$state_dir/$database.last-success"
now="$(date -u +%s)"

if [[ -f "$state_file" ]]; then
  last_success="$(cat -- "$state_file")"

  if [[ ! "$last_success" =~ ^[0-9]{1,10}$ ]]; then
    printf 'Invalid backup timestamp in %s\n' "$state_file" >&2
    exit 1
  fi

  elapsed=$((now - 10#$last_success))

  if (( elapsed >= 0 && elapsed < 86400 )); then
    printf 'Backup for %s is current; last success was %s seconds ago.\n' \
      "$database" "$elapsed"
    exit 0
  fi
fi

bash "$script_dir/backup-db.sh" "$database"

state_tmp="$(mktemp "$state_dir/.last-success.XXXXXX")"
trap 'rm -f -- "$state_tmp"' EXIT

date -u +%s > "$state_tmp"
mv -T -- "$state_tmp" "$state_file"

printf 'Recorded successful backup for %s.\n' "$database"
