#!/usr/bin/env bash
# Manually deploy the reviewed iRadios production branch. Never starts stage or Mailpit.
set -Eeuo pipefail
umask 027
APP=/srv/iradios/production/app
ENV=/etc/iradios/production/compose.env
BACKEND_ENV=/etc/iradios/production/backend.env
LOCK=/run/lock/iradios-production-deploy.lock
[[ "$(id -u)" == 0 ]] || { echo "Use sudo" >&2; exit 1; }
cd "$APP"
for cmd in git docker curl python3 flock; do
  command -v "$cmd" >/dev/null || { echo "STOP: missing $cmd" >&2; exit 1; }
done
exec 9>"$LOCK"
flock -n 9 || { echo "STOP: production deploy already running"; exit 1; }
[[ -s "$ENV" && -s "$BACKEND_ENV" ]] || { echo "STOP: missing production secrets"; exit 1; }
[[ -f /etc/iradios/production/data-verified ]] || {
  echo "STOP: production MongoDB/users/stations/uploads not verified. See runbook." >&2
  exit 1
}
branch=$(git -c safe.directory="$APP" branch --show-current)
[[ "$branch" == main ]] || { echo "STOP: expected main, found $branch" >&2; exit 1; }
git -c safe.directory="$APP" diff --quiet
git -c safe.directory="$APP" diff --cached --quiet
origin=$(git -c safe.directory="$APP" remote get-url origin)
[[ "$origin" =~ ^(https://github\.com/|git@github\.com:|ssh://git@github\.com/)ilumadigital/iRadiosGR(\.git)?/?$ ]] || {
  echo "STOP: wrong Git remote" >&2; exit 1;
}
python3 ops/check-prod-env.py "$BACKEND_ENV" "$ENV"
git -c safe.directory="$APP" pull --ff-only origin main
python3 ops/check-prod-env.py "$BACKEND_ENV" "$ENV"
compose=(docker compose --env-file "$ENV" -f compose.prod.yml -f compose.prod.replicaset.yml)
"${compose[@]}" config --quiet
"${compose[@]}" build backend frontend
"${compose[@]}" up -d --no-build --pull never mongo backend frontend
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:5611/api/health
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:5610/ >/dev/null
echo
echo "PRODUCTION deployed on localhost ports 5610/5611 (no DNS/Nginx/Gateway changes)"
