#!/usr/bin/env bash
# One-time production-only Mongo secrets; no remote network calls, no payment keys.
set -Eeuo pipefail
umask 077
[[ "$(id -u)" == 0 ]] || { echo "STOP: run via sudo" >&2; exit 1; }
ROOT=/etc/iradios/production
APP=/srv/iradios/production/app
[[ -f "$APP/compose.prod.replicaset.yml" ]] || { echo "STOP: production replica-set source absent" >&2; exit 1; }
[[ -d "$ROOT" ]] || { echo "STOP: production secrets directory missing" >&2; exit 1; }
for path in "$ROOT/compose.env" "$ROOT/backend.env" "$ROOT/mongo-replset.key"; do
 [[ ! -e "$path" && ! -L "$path" ]] || { echo "STOP: existing production secrets; refusing overwrite" >&2; exit 1; }
done
for cmd in openssl docker install stat; do command -v "$cmd" >/dev/null || { echo "STOP: $cmd not installed" >&2; exit 1; }; done
[[ "$(stat -c %a "$ROOT")" == 700 ]] || { echo "STOP: production secrets directory must be mode 700" >&2; exit 1; }
[[ "$(docker inspect --format '{{.State.Running}}' iradios_stage-mongo-1)" == true ]] || { echo "STOP: staging Mongo unavailable for image UID lookup" >&2; exit 1; }
uid=$(docker exec iradios_stage-mongo-1 id -u mongodb)
gid=$(docker exec iradios_stage-mongo-1 id -g mongodb)
[[ "$uid" =~ ^[0-9]+$ && "$gid" =~ ^[0-9]+$ ]] || { echo "STOP: unexpected Mongo UID/GID" >&2; exit 1; }
# Production secrets use independent random values; never print them or source .env.
root_pass=$(openssl rand -hex 32)
app_pass=$(openssl rand -hex 32)
printf 'PROD_MONGO_PASSWORD=%s\nPROD_MONGO_APP_PASSWORD=%s\n' "$root_pass" "$app_pass" > "$ROOT/compose.env"
cat > "$ROOT/backend.env" <<'ENV'
APP_ENV=production
NODE_ENV=production
PORT=5011
FRONTEND_URL=https://play.iradios.gr
IRADIOS_GATEWAY_ENV=production
IRADIOS_BILLING_ENABLED=0
IRADIOS_PRODUCTION_CUTOVER_APPROVED=0
PRODUCTION_BILLING_EMAILS_ENABLED=0
ENV
# Real SMTP, Cloudflare Turnstile, Gateway credentials intentionally omitted;
# no production application container may start until those are configured.
install -m 0400 -o "$uid" -g "$gid" /dev/null "$ROOT/mongo-replset.key"
openssl rand -base64 756 | tr -d '\n' > "$ROOT/mongo-replset.key"
chmod 600 "$ROOT/compose.env" "$ROOT/backend.env"
chmod 400 "$ROOT/mongo-replset.key"
echo "PASS: independent production Mongo credentials/keyfile created (values hidden)."
echo "NOTE: production backend, payment Gateway and SMTP NOT enabled."
