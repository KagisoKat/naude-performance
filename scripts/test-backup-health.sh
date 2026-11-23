#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
test_dir="$(mktemp -d /tmp/naude-health-test.XXXXXX)"
fixture_backup="$test_dir/backups/naude-$(date -u +%Y%m%d-%H%M%S).fixture"
cleanup() {
  rm -f -- "$test_dir/naude.last-success"

  if [[ -d "$fixture_backup" ]]; then
    rm -f -- "$fixture_backup/"*
    rmdir -- "$fixture_backup"
  fi

  if [[ -d "$test_dir/backups" ]]; then
    rmdir -- "$test_dir/backups"
  fi

  rmdir -- "$test_dir"
}
trap cleanup EXIT

assert_status() {
  local label="$1"
  local expected="$2"
  local actual
  local output

  if output="$(NAUDE_BACKUP_STATE_DIR="$test_dir" \
    NAUDE_BACKUP_ROOT="$test_dir/backups" \
    bash "$script_dir/check-backup-health.sh" naude 2>&1)"; then
    actual=0
  else
    actual=$?
  fi

  if [[ "$actual" -ne "$expected" ]]; then
    printf 'FAIL: %s — expected %s, received %s\n' \
      "$label" "$expected" "$actual" >&2
    printf '%s\n' "$output" >&2
    exit 1
  fi

  printf 'PASS: %s — exit status %s\n' "$label" "$actual"
}

mkdir -p "$fixture_backup"

printf 'Test archive contents\n' > "$fixture_backup/database.dump"
printf 'Test archive listing\n' > "$fixture_backup/archive-list.txt"
printf 'Test restore report\n' > "$fixture_backup/restore-check.txt"

(
  cd -- "$fixture_backup"
  sha256sum database.dump > SHA256SUMS
)

assert_status "missing backup record" 1

date -u +%s > "$test_dir/naude.last-success"
assert_status "recent backup" 0

fresh_fixture="$fixture_backup"
old_fixture="$test_dir/backups/naude-$(date -u -d '27 hours ago' +%Y%m%d-%H%M%S).fixture"

mv -- "$fixture_backup" "$old_fixture"
fixture_backup="$old_fixture"
assert_status "old archive with recent success record" 1

mv -- "$fixture_backup" "$fresh_fixture"
fixture_backup="$fresh_fixture"

date -u -d '27 hours ago' +%s > "$test_dir/naude.last-success"
assert_status "overdue backup" 1

printf 'broken-timestamp\n' > "$test_dir/naude.last-success"
assert_status "invalid timestamp" 2

date -u -d '1 hour' +%s > "$test_dir/naude.last-success"
assert_status "future timestamp" 2

date -u +%s > "$test_dir/naude.last-success"
rm -- "$fixture_backup/restore-check.txt"
assert_status "missing restore report" 1
printf 'Test restore report\n' > "$fixture_backup/restore-check.txt"

printf 'Unexpected modification\n' >> "$fixture_backup/database.dump"
assert_status "modified backup archive" 1

rm -- "$fixture_backup/database.dump" "$fixture_backup/SHA256SUMS" \
  "$fixture_backup/archive-list.txt" "$fixture_backup/restore-check.txt"
rmdir -- "$fixture_backup"
assert_status "no completed backup" 1

rmdir -- "$test_dir/backups"
assert_status "missing backup directory" 1

printf 'All ten backup-health checks passed.\n'
