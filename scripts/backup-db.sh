#!/usr/bin/env bash

set -euo pipefail
umask 077

database="${1:-naude_test}"

if [[ "$database" != "naude" && "$database" != "naude_test" ]]; then
  printf 'Choose naude or naude_test.\n' >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd -- "$script_dir/.." && pwd)"
backup_root="$HOME/naude-db-backups"

mkdir -p "$backup_root" "$HOME/.cache"

exec 9>"$HOME/.cache/naude-db-backup.lock"
flock -x 9

stamp="$(date -u +%Y%m%d-%H%M%S)"
work_dir="$(mktemp -d "$backup_root/.${database}-${stamp}.XXXXXX")"

cleanup() {
  if [[ -n "$work_dir" && -d "$work_dir" ]]; then
       rm -f -- "$work_dir/database.dump" \
      "$work_dir/archive-list.txt" "$work_dir/SHA256SUMS" \
      "$work_dir/restore-check.txt"
  fi
}

trap cleanup EXIT

cd -- "$project_dir"

printf 'Starting backup at %s for database %s\n' "$stamp" "$database"

docker compose exec -T db pg_dump \
  -U naude_user -d "$database" -Fc > "$work_dir/database.dump"

docker compose exec -T db pg_restore --list \
  < "$work_dir/database.dump" > "$work_dir/archive-list.txt"

(
  cd -- "$work_dir"
  sha256sum database.dump > SHA256SUMS
  sha256sum --check SHA256SUMS
)

printf 'Testing restore before publishing the backup\n'

bash "$script_dir/verify-db-backup.sh" "$work_dir" \
  2>&1 | tee "$work_dir/restore-check.txt"
directory_name="${work_dir##*/}"
final_dir="$backup_root/${directory_name#.}"

mv -T -- "$work_dir" "$final_dir"
work_dir=""

printf 'Backup completed: %s\n' "$final_dir"
