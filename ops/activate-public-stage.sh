#!/usr/bin/env bash
# Open only the stage public radio frontend. Fail closed / restore Basic Auth
# if the new backend JWT API guard or any origin HTTPS smoke check fails.
set -euo pipefail
[[ "$(id -u)" == "0" ]] || { echo "Run as root" >&2; exit 1; }
cd /srv/iradios/staging/app
CONF=/etc/nginx/sites-available/iradios-stage
# Detect which config actually serves stage.iradios.gr. Editing a sites-available
# file that isn't loaded by Nginx leaves the old Basic Auth in effect.
ACTIVE_SOURCES=$(nginx -T 2>&1 | awk '
  /^# configuration file / { file=$4; sub(/:$/, "", file) }
  /^[[:space:]]*server_name[[:space:]]+stage\\.iradios\\.gr;/ { if (file != "") print file }
' | sort -u)
if [[ -z "$ACTIVE_SOURCES" ]]; then
  echo "STOP: no loaded Nginx server_name for stage.iradios.gr" >&2
  exit 1
fi
if [[ "$(printf '%s\\n' "$ACTIVE_SOURCES" | wc -l)" -ne 1 ]]; then
  echo "STOP: multiple active Nginx configuration files for stage.iradios.gr:" >&2
  printf '%s\\n' "$ACTIVE_SOURCES" >&2
  exit 1
fi
ACTIVE_FILE=$(readlink -f "$ACTIVE_SOURCES")
EXPECTED_FILE=$(readlink -f "$CONF")
if [[ "$ACTIVE_FILE" != "$EXPECTED_FILE" ]]; then
  echo "STOP: Nginx serves stage from $ACTIVE_FILE, not $EXPECTED_FILE." >&2
  echo "Resolve site alias or duplicate config first; no changes made." >&2
  exit 1
fi
echo "Active stage Nginx config: $ACTIVE_FILE"
test -s "$CONF"
test -s ops/nginx-stage.conf
grep -q 'auth_basic off;' ops/nginx-stage.conf
grep -q "app.use('/api', require('./utils/stagePublicAccess').stagePublicAccess)" backend/server.js
echo "Checking deployed staging backend safety BEFORE removing Basic Auth..."
code() { curl -sS --connect-timeout 4 --max-time 10 -o /dev/null -w '%{http_code}' "http://127.0.0.1:5511$1"; }
expect() {
 local label="$1" want="$2" path="$3" got
 got=$(code "$path")
 echo "$label: HTTP $got (expected $want)"
 [[ "$got" == "$want" ]] || { echo "STOP: backend not safe for public exposure" >&2; exit 1; }
}
expect "Public catalog" 200 /api/stations
expect "Admin records protected" 401 /api/admin/users
expect "Unpublished station records protected" 401 /api/stations/all
expect "Account records protected" 401 /api/auth/me
expect "Agency records protected" 401 /api/agency/no-such-id
expect "Dangerous private-IP stream blocked" 400 '/api/proxy-stream?url=http%3A%2F%2F127.0.0.1%3A27017'
if ! bash ops/check-stage-source.sh; then echo "Stage source safety preflight failed" >&2; exit 1; fi
umask 077
BACKUP="$CONF.bak-before-public.$(date -u +%Y%m%d%H%M%S)"
cp -a "$CONF" "$BACKUP"
echo "Nginx rollback backup: $BACKUP"
ACTIVATED=0
rollback() {
  if [[ "$ACTIVATED" != 1 ]]; then
    echo "Rolling back Nginx; public-stage verification did not pass" >&2
    cp -a "$BACKUP" "$CONF"
    nginx -t && systemctl reload nginx || true
  fi
}
trap rollback ERR
install -o root -g root -m 644 ops/nginx-stage.conf "$CONF"
nginx -t
systemctl reload nginx

# Nginx reload is asynchronous. Do not mistake the first old-worker 401
# response for a persistent config failure and immediately roll back.
READY=0
for i in $(seq 1 12); do
  code=$(curl --noproxy '*' --resolve stage.iradios.gr:443:127.0.0.1 \
    -sS --connect-timeout 3 --max-time 6 -o /dev/null -w '%{http_code}' \
    https://stage.iradios.gr/ || true)
  if [[ "$code" == "200" ]]; then
    READY=1
    echo "Public stage homepage is live: HTTP 200"
    break
  fi
  echo "Waiting for HTTPS site reload: observed HTTP ${code:-unavailable}"
  sleep 1
done
if [[ "$READY" != 1 ]]; then
  echo "STOP: Nginx still returns 401/non-200 after public config reload" >&2
  nginx -T 2>&1 | grep -n -B 3 -A 3 'auth_basic' || true
  false
fi
bash ops/test-public-stage.sh
ACTIVATED=1
trap - ERR
echo "PUBLIC STAGE ENABLED: radio preview public; Mailpit/private APIs remain blocked."
echo "Rollback backup retained at $BACKUP"
