#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  printf 'Usage: bash scripts/verify-db-backup.sh BACKUP_DIRECTORY\n' >&2
  exit 1
fi

backup_dir="$(cd -- "$1" && pwd)"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd -- "$script_dir/.." && pwd)"

(
  cd -- "$backup_dir"
  sha256sum --check SHA256SUMS
)

restore_db="naude_restore_check_$(date -u +%Y%m%d%H%M%S)_$$"
created=false

cd -- "$project_dir"

cleanup() {
  local result=$?

  trap - EXIT

  if [[ "$created" == true ]]; then
    if ! docker compose exec -T db dropdb \
      -U naude_user "$restore_db"; then
      printf 'Cleanup failed for database %s\n' "$restore_db" >&2
      result=1
    fi
  fi

  exit "$result"
}

trap cleanup EXIT

printf 'Creating restore-check database: %s\n' "$restore_db"

docker compose exec -T db createdb \
  -U naude_user -T template0 "$restore_db"
created=true

docker compose exec -T db pg_restore \
  -U naude_user -d "$restore_db" \
  --single-transaction --exit-on-error \
  < "$backup_dir/database.dump"

docker compose exec -T db psql \
  -U naude_user -d "$restore_db" \
  -v ON_ERROR_STOP=1 \
  -c 'SELECT
        current_database() AS restored_database,
        (SELECT count(*) FROM schema_migrations) AS migrations,
        (SELECT count(*) FROM users) AS users,
        (SELECT count(*) FROM orders) AS orders,
        (SELECT count(*) FROM order_items) AS order_items;'

printf 'Restore and table checks passed for %s\n' "$backup_dir"
