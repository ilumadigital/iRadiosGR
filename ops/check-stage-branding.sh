#!/usr/bin/env bash
# Read-only verification of exact SVG assets used by the app and station console.
# A missing SVG may fall through to React's index.html with HTTP 200.
set -euo pipefail

APP=/srv/iradios/staging/app
PUBLIC="$APP/frontend/public"
assets=(noicon-iradios-app-logo.svg iradios-app-logo.svg icon-tr.svg)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

check() {
  local label="$1" expected="$2"
  shift 2
  echo "Checking $label ..."
  local code
  code=$(curl --silent --show-error --location --max-time 20 \
    --output "$tmp/body" --dump-header "$tmp/headers" \
    --write-out '%{http_code}' "$@")
  if [[ "$code" != "200" ]]; then
    echo "FAIL: HTTP $code" >&2
    return 1
  fi
  if ! grep -iq '^content-type: image/svg+xml' "$tmp/headers"; then
    echo "FAIL: not image/svg+xml (possibly React index.html fallback)" >&2
    return 1
  fi
  if ! cmp -s "$expected" "$tmp/body"; then
    echo "FAIL: served SVG differs from the expected Git staging asset" >&2
    return 1
  fi
  echo "OK: matching SVG ($(wc -c < "$tmp/body") bytes)"
}

for asset in "${assets[@]}"; do
  expected="$PUBLIC/$asset"
  if [[ ! -s "$expected" ]]; then
    echo "FAIL: missing or empty $expected" >&2
    exit 1
  fi
  check "Docker frontend /$asset" "$expected" \
    "http://127.0.0.1:5510/$asset"
  check "Host Nginx HTTPS /$asset" "$expected" \
    --noproxy '*' --resolve stage.iradios.gr:443:127.0.0.1 \
    "https://stage.iradios.gr/$asset"
done
echo "Stage SVG branding matches frontend container and HTTPS."
