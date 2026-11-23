#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

printf 'Checking Bash script syntax...\n'

count=0

for script in "$script_dir"/*.sh; do
  printf 'Checking: %s\n' "$(basename -- "$script")"
  bash -n "$script"
  count=$((count + 1))
done

printf 'Syntax checks passed for %s scripts.\n' "$count"

printf '\nRunning backup-health tests...\n'
bash "$script_dir/test-backup-health.sh"

printf '\nAll script checks passed.\n'
