#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd -- "$script_dir/.." && pwd)"
database="${1:-naude_test}"

cd -- "$project_dir"

printf 'Starting order expiry at %s for database %s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$database"

docker compose exec -T -e "DB_NAME=$database" backend \
  node scripts/expireOrders.js

printf 'Order expiry completed at %s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
