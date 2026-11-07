#!/usr/bin/env bash
# Read-only verification: PNG branding must be served as PNG, never as React
# index.html (the SPA fallback often returns HTTP 200 for missing images).
set -euo pipefail
test -f /srv/iradios/staging/app/frontend/public/noicon-iradios-app-logo.png || {
  echo "Missing original sidebar PNG in frontend/public." >&2
  exit 1
}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

check() {
  local label="$1"
  shift
  echo "Checking $label ..."
  local code
  code=$(curl --silent --show-error --location --max-time 20 \
    --output "$tmp/body" --dump-header "$tmp/headers" \
    --write-out '%{http_code}' "$@")
  if [[ "$code" != "200" ]]; then
    echo "FAIL: HTTP $code" >&2; return 1
  fi
  if ! grep -iq '^content-type: image/png' "$tmp/headers"; then
    echo "FAIL: missing image/png MIME type (likely SPA index.html fallback)" >&2
    return 1
  fi
  python3 - "$tmp/body" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
data = p.read_bytes()
assert len(data) >= 40, "image is empty"
assert data[:8] == b'\x89PNG\r\n\x1a\n', "not a real PNG"
print(f"OK: valid PNG ({len(data)} bytes)")
PY
}
check "Docker frontend static asset" \
  'http://127.0.0.1:5510/noicon-iradios-app-logo.png'
check "Host Nginx HTTPS static asset" \
  --noproxy '*' --resolve stage.iradios.gr:443:127.0.0.1 \
  'https://stage.iradios.gr/noicon-iradios-app-logo.png'
echo "Stage sidebar branding asset is restored and served correctly."
