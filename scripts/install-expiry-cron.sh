#!/usr/bin/env bash

set -euo pipefail

database="${1:-naude_test}"

if [[ "$database" != "naude" && "$database" != "naude_test" ]]; then
  printf 'Choose naude or naude_test.\n' >&2
  exit 1
fi

mkdir -p "$HOME/naude-logs" "$HOME/.cache"

exec 9>"$HOME/.cache/naude-expiry-install.lock"
flock -x 9

schedule="$(mktemp)"
errors="$(mktemp)"
trap 'rm -f -- "$schedule" "$errors"' EXIT

if ! crontab -l > "$schedule" 2> "$errors"; then
  if ! grep -q 'no crontab for' "$errors"; then
    cat "$errors" >&2
    exit 1
  fi
fi

backup="$(mktemp "$HOME/naude-logs/crontab-before-expiry.XXXXXX")"
cp -- "$schedule" "$backup"

sed -i '\|/home/vagrant/naude/scripts/expire-orders\.sh|d' "$schedule"

printf '%s\n' \
  "*/5 * * * * PATH=/usr/bin:/bin /usr/bin/flock -n /home/vagrant/.cache/naude-order-expiry.lock /usr/bin/bash /home/vagrant/naude/scripts/expire-orders.sh $database >> /home/vagrant/naude-logs/order-expiry.log 2>&1 # NAUDE_ORDER_EXPIRY" \
  >> "$schedule"

crontab "$schedule"

printf 'Previous crontab saved to %s\n' "$backup"
printf 'Installed order expiry every five minutes for %s.\n' "$database"
crontab -l
