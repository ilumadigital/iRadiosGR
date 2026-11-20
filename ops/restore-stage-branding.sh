#!/usr/bin/env bash
# Restore the original, PUBLIC production branding images to staging.
# Production is read-only. No database, passwords, private uploads or live
# config are touched. Missing PNGs were excluded from the source-only Git repo.
set -euo pipefail

[[ "$(id -u)" == "0" ]] || { echo "Run with sudo on the Hostinger stage." >&2; exit 1; }
umask 022
APP=/srv/iradios/staging/app
PUBLIC="$APP/frontend/public"
ORIGIN=https://play.iradios.gr
cd "$APP"
test -f compose.stage.yml
test -d "$PUBLIC"
id iradios >/dev/null
command -v curl >/dev/null
command -v python3 >/dev/null

TEMP=$(mktemp -d)
trap 'rm -rf "$TEMP"' EXIT

# Restore the exact paths referenced in the app. The sidebar logo is required;
# ancillary brand images are best-effort because versions differ by release.
assets=(
  noicon-iradios-app-logo.png
  iradios-logo.png
  iradios-app-logo.png
  favicon.png
  iradios-wall.png
  presskit/iradios_fbcover-logo.png
  presskit/iradios_fbcover-mockups.png
)
downloaded=0
for rel in "${assets[@]}"; do
  dest="$PUBLIC/$rel"
  tmp="$TEMP/${rel//\//_}"
  printf 'Checking original /%s ... ' "$rel"
  # --proto-redir blocks HTTP downgrade. Only a public HTTPS source is used.
  if ! curl --fail --location --silent --show-error \
    --proto '=https' --proto-redir '=https' \
    --connect-timeout 8 --max-time 35 \
    --output "$tmp" "$ORIGIN/$rel"; then
    if [[ "$rel" == noicon-iradios-app-logo.png ]]; then
      echo "FAILED: primary logo not found on production." >&2
      echo "Do not substitute the Vite index.html response for a PNG." >&2
      exit 1
    fi
    echo "not found (optional)"
    continue
  fi
  if ! python3 - "$tmp" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
data = p.read_bytes()
# Vite returns index.html with HTTP 200 for nonexistent static paths.
# Never copy HTML or a broken partial response under a .png name.
assert len(data) >= 40 and len(data) <= 12 * 1024 * 1024
assert data[:8] == b'\x89PNG\r\n\x1a\n'
assert data[12:16] == b'IHDR'
w = int.from_bytes(data[16:20], 'big')
h = int.from_bytes(data[20:24], 'big')
assert 1 <= w <= 8192 and 1 <= h <= 8192
PY
  then
    if [[ "$rel" == noicon-iradios-app-logo.png ]]; then
      echo "FAILED: production did not send a valid PNG for the primary logo." >&2
      exit 1
    fi
    echo "not a PNG (optional)"
    continue
  fi
  install -d -o iradios -g iradios -m 755 "$(dirname "$dest")"
  install -o iradios -g iradios -m 644 "$tmp" "$dest"
  echo "OK"
  downloaded=$((downloaded+1))
done

[[ -s "$PUBLIC/noicon-iradios-app-logo.png" ]] || {
  echo "Required sidebar logo missing; no deploy attempted." >&2; exit 1;
}
echo "Recovered $downloaded authentic production branding images into staging."
echo "Next: sudo bash ops/deploy-stage.sh"
echo "Then: sudo bash ops/check-stage-branding.sh"
