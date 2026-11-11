#!/usr/bin/env bash
# Verify public staging through local HTTPS origin (bypasses Cloudflare DNS).
# Must be run on Hostinger VPS. Does not print user/station data or secrets.
set -euo pipefail
HOST=stage.iradios.gr
BASE="https://$HOST"
# Always hit the local origin even if HTTPS_PROXY is set on the VPS.
OPT=(--noproxy '*' --resolve "$HOST:443:127.0.0.1" -sS --connect-timeout 4 --max-time 15)
check() {
  local label="$1" expected="$2" method="$3" url="$4" status
  status=$(curl "${OPT[@]}" -o /dev/null -w '%{http_code}' -X "$method" "$BASE$url")
  echo "$label: HTTP $status (expected $expected)"
  [[ "$status" == "$expected" ]] || return 1
}
check "Public frontend" 200 GET /
check "Public station listing" 200 GET /api/stations
check "No anonymous admin records" 401 GET /api/admin/users
check "No anonymous all-stations admin" 401 GET /api/stations/all
check "Mailpit closed to public" 403 GET /dev/mail/
check "Legacy websockets denied" 403 GET /api/socket.io/
check "Private stream SSRF guard" 400 GET '/api/proxy-stream?url=http%3A%2F%2F127.0.0.1%3A27017'
check "Unapproved stream forbidden" 403 GET '/api/proxy-stream?url=https%3A%2F%2Fexample.com%2Fstream'
check "Imported private user record blocked" 401 GET /api/auth/me
check "Anonymous Cloudflare config available" 200 GET /api/auth/turnstile-config
# Without a Cloudflare challenge, public login must return 400 turnstile_missing,
# never 401 from an unrelated global JWT middleware. No real credentials used.
curl "${OPT[@]}" -H 'Content-Type: application/json' \
  --data '{"identifier":"iradios-stage-smoke","password":"test-only","cfToken":""}' \
  -w '\n%{http_code}' "$BASE/api/auth/login" |
  python3 -c 'import json,sys; parts=sys.stdin.read().splitlines(); assert parts[-1]=="400", "Login did not reach Turnstile"; assert json.loads("\n".join(parts[:-1])).get("code")=="turnstile_missing"; print("Anonymous login reaches mandatory Cloudflare verification; no JWT precondition")'
curl "${OPT[@]}" -fsS "$BASE/api/auth/turnstile-config" |
  python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("ready") is True and isinstance(d.get("siteKey"),str) and len(d["siteKey"])>10; assert "secret" not in d; print("Turnstile public config ready (key hidden)")'
curl "${OPT[@]}" -fsS "$BASE/api/stations" |
  python3 -c 'import json,sys; a=json.load(sys.stdin); assert isinstance(a,list); assert len(a)>=1; assert all("email" not in x and "phone" not in x and "pendingEdits" not in x for x in a); print("Public stations: "+str(len(a))+"; personal fields excluded")'
echo "PUBLIC STAGE HTTPS SECURITY SMOKE CHECKS PASSED"
