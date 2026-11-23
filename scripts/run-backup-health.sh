#!/usr/bin/env bash

set -euo pipefail

database="${1:-naude_test}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

printf 'Backup health check started at %s for %s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$database"

if bash "$script_dir/check-backup-health.sh" "$database"; then
  result=0
else
  result=$?
fi

printf 'Backup health check finished at %s with status %s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$result"

exit "$result"
