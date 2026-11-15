#!/usr/bin/env bash
set -euo pipefail
APP=/srv/iradios/staging/app
ENV=/etc/iradios/staging/compose.env
[[ "$(id -u)" == "0" ]] || { echo 'Run as root via sudo'; exit 1; }
[[ -f "$ENV" ]] || { echo "Missing $ENV. Run ops/init-stage-secrets.sh"; exit 1; }
cd "$APP"
[[ -f compose.stage.yml ]] || { echo 'Missing compose.stage.yml'; exit 1; }
# Existing staging databases remain standalone unless the operator explicitly
# opts into an authenticated, initialized replica set after a verified backup.
compose_files=(-f compose.stage.yml)
replica_set_enabled=0
if grep -qx 'STAGE_MONGO_RS_ENABLED=1' "$ENV"; then
  [[ -s /etc/iradios/staging/mongo-replset.key ]] || {
    echo 'STOP: missing private stage Mongo replica-set keyfile.' >&2; exit 1;
  }
  [[ -f compose.stage.replicaset.yml ]] || {
    echo 'STOP: missing replica-set Compose override.' >&2; exit 1;
  }
  compose_files+=(-f compose.stage.replicaset.yml)
  replica_set_enabled=1
  echo 'Stage MongoDB replica-set override enabled.'
fi
# Never enable paid event settlement on standalone MongoDB. This preflight is
# necessary but NOT sufficient: a signed trusted geo ingress is also required.
if grep -qx 'ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=1' /etc/iradios/staging/backend.env &&
   [[ "$replica_set_enabled" != 1 ]]; then
  echo 'STOP: Advertising v2 paid delivery requires a stage Mongo replica set.' >&2
  exit 1
fi
# No live URLs, keys or Stage->Prod accident in tracked code.
./ops/check-stage-source.sh
docker compose --env-file "$ENV" "${compose_files[@]}" config --quiet
build_args=(--pull)
# An opt-in full rebuild, used by ./ilumadev.sh --fresh. Default remains
# incremental, preserving shared Docker build cache and avoiding host-wide prune.
if [[ "${IRADIOS_STAGE_NO_CACHE:-0}" == "1" ]]; then
  build_args+=(--no-cache)
fi
docker compose --env-file "$ENV" "${compose_files[@]}" build "${build_args[@]}"
docker compose --env-file "$ENV" "${compose_files[@]}" up -d --remove-orphans
docker compose --env-file "$ENV" "${compose_files[@]}" ps
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:5511/api/health >/dev/null && curl -fsS http://127.0.0.1:5510/ >/dev/null; then
    # A green build is not enough if public sign-in has no Turnstile site key.
    # Validate the RUNNING backend without printing any key or secret.
    if ! curl -fsS --max-time 6 http://127.0.0.1:5511/api/auth/turnstile-config |
      python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("ready") is True and isinstance(d.get("siteKey"),str) and len(d["siteKey"])>10 else 1)'; then
      echo 'Stage Turnstile runtime config unavailable; check the backend container and backend.env (keys hidden).' >&2
      exit 1
    fi
    # An anonymous login with no challenge MUST reach Turnstile validation.
    # HTTP 401 indicates a premature JWT guard (billing router regression).
    if ! curl -sS --max-time 6 -H 'Content-Type: application/json' \
      --data '{"identifier":"iradios-stage-smoke","password":"test-only","cfToken":""}' \
      -w '\n%{http_code}' http://127.0.0.1:5511/api/auth/login |
      python3 -c 'import json,sys; parts=sys.stdin.read().splitlines(); assert parts[-1]=="400"; assert json.loads("\n".join(parts[:-1])).get("code")=="turnstile_missing"'; then
      echo 'STOP: anonymous login did not reach mandatory Turnstile validation; check global JWT middleware and billing routers.' >&2
      exit 1
    fi
    # A bare app.use('/api', advertisingRouter) previously intercepted ALL
    # anonymous streams with 401 before the real proxy handler. An invalid URL
    # must reach the public proxy validator and return 400, not JWT 401.
    if ! curl -sS --max-time 6 -w '\n%{http_code}' \
      'http://127.0.0.1:5511/api/proxy-stream?url=not-a-url' | \
      python3 -c 'import json,sys; t=sys.stdin.read().splitlines(); assert t[-1]=="400"; assert json.loads("\n".join(t[:-1])).get("error")=="Disallowed stream target"'; then
      echo 'STOP: anonymous radio proxy is blocked by authorization middleware or is not reaching the stream validator.' >&2
      exit 1
    fi
    # Verify that PWA static assets are served from the frontend container.
    # Host CDN/Cloudflare 403 requires an additional public-edge check.
    for asset in manifest.json favicon.png; do
      asset_status=$(curl -sS --max-time 6 -o /dev/null -w '%{http_code}' "http://127.0.0.1:5510/$asset")
      if [[ "$asset_status" != 200 ]]; then
        echo "STOP: frontend static /$asset returned HTTP $asset_status from the container." >&2
        exit 1
      fi
    done
    echo 'Stage backend, anonymous radio proxy, frontend PWA assets, login routing and Turnstile healthy on localhost.'
    exit 0
  fi
  sleep 5
done
echo 'Health-check failed. Inspect: docker compose -f compose.stage.yml logs --tail=80' >&2
exit 1
