#!/usr/bin/env bash
# Open only the stage public radio frontend. Fail closed / restore Basic Auth
# if the new backend JWT API guard or any origin HTTPS smoke check fails.
set -euo pipefail
[[ "$(id -u)" == "0" ]] || { echo "Run as root" >&2; exit 1; }
cd /srv/iradios/staging/app
CONF=/etc/nginx/sites-available/iradios-stage
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
bash ops/test-public-stage.sh
ACTIVATED=1
trap - ERR
echo "PUBLIC STAGE ENABLED: radio preview public; Mailpit/private APIs remain blocked."
echo "Rollback backup retained at $BACKUP"
