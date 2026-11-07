#!/usr/bin/env bash
set -euo pipefail
APP=/srv/iradios/staging/app
ENV=/etc/iradios/staging/compose.env
[[ "$(id -u)" == "0" ]] || { echo 'Run as root via sudo'; exit 1; }
[[ -f "$ENV" ]] || { echo "Missing $ENV. Run ops/init-stage-secrets.sh"; exit 1; }
cd "$APP"
[[ -f compose.stage.yml ]] || { echo 'Missing compose.stage.yml'; exit 1; }
# No live URLs, keys or Stage->Prod accident in tracked code.
./ops/check-stage-source.sh
docker compose --env-file "$ENV" -f compose.stage.yml config --quiet
build_args=(--pull)
# An opt-in full rebuild, used by ./ilumadev.sh --fresh. Default remains
# incremental, preserving shared Docker build cache and avoiding host-wide prune.
if [[ "${IRADIOS_STAGE_NO_CACHE:-0}" == "1" ]]; then
  build_args+=(--no-cache)
fi
docker compose --env-file "$ENV" -f compose.stage.yml build "${build_args[@]}"
docker compose --env-file "$ENV" -f compose.stage.yml up -d --remove-orphans
docker compose --env-file "$ENV" -f compose.stage.yml ps
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:5511/api/health >/dev/null && curl -fsS http://127.0.0.1:5510/ >/dev/null; then
    echo 'Stage backend and frontend healthy on localhost.'
    exit 0
  fi
  sleep 5
done
echo 'Health-check failed. Inspect: docker compose -f compose.stage.yml logs --tail=80' >&2
exit 1
