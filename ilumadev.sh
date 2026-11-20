#!/usr/bin/env bash
# ILUMA Digital Agency | iRadiosGR Hostinger staging updater
# Usage: sudo ./ilumadev.sh [--fresh]
# Only touches /srv/iradios/staging/app and old, unused staging app images.
# Never prunes Docker volumes, shared build cache, uploads, DBs or secrets.
set -Eeuo pipefail
umask 027

APP=/srv/iradios/staging/app
STAGE_ENV=/etc/iradios/staging/compose.env
LOCK=/run/lock/iradios-stage-ilumadev.lock
FRESH=0

usage() {
  echo "Usage: sudo ./ilumadev.sh [--fresh]"
  echo "  default: git pull, clean stage temp builds, cached Docker rebuild, health checks"
  echo "  --fresh: same steps, but rebuild backend/frontend with --no-cache"
}

if (( $# > 1 )); then usage >&2; exit 2; fi
case "${1:-}" in
  "") ;;
  --fresh) FRESH=1 ;;
  -h|--help) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo ./ilumadev.sh" >&2
  exit 1
fi

for cmd in git docker curl sudo flock; do
  command -v "$cmd" >/dev/null || { echo "Missing command: $cmd" >&2; exit 1; }
done
[[ -d "$APP/.git" && -f "$APP/compose.stage.yml" ]] || {
  echo "STOP: not the expected iRadiosGR staging checkout: $APP" >&2
  exit 1
}
[[ -s "$STAGE_ENV" && -s /etc/iradios/staging/backend.env ]] || {
  echo "STOP: missing stage-only secrets files in /etc/iradios/staging" >&2
  exit 1
}

exec 9>"$LOCK"
flock -n 9 || { echo "A staging update is already running." >&2; exit 1; }

cd "$APP"
branch=$(sudo -u iradios git branch --show-current)
[[ "$branch" == staging ]] || {
  echo "STOP: checked out branch is '$branch', expected 'staging'." >&2
  exit 1
}
origin=$(sudo -u iradios git remote get-url origin)
if [[ ! "$origin" =~ ^(https://github\.com/|git@github\.com:|ssh://git@github\.com/)ilumadigital/iRadiosGR(\.git)?/?$ ]]; then
  echo "STOP: unexpected Git remote; refusing to deploy from: $origin" >&2
  exit 1
fi

# Protect local tracked changes, including manually edited configuration.
# Untracked restored production PNG logos are intentionally left untouched.
if ! sudo -u iradios git diff --quiet ||
   ! sudo -u iradios git diff --cached --quiet; then
  echo "STOP: tracked local changes detected. Review 'sudo -u iradios git status' first." >&2
  exit 1
fi

echo "=========================================================="
echo "  ILUMADEV | iRadiosGR STAGING | $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================================="
echo "[1/5] Pulling GitHub staging (fast-forward only)..."
sudo -u iradios git pull --ff-only origin staging
echo "Revision: $(sudo -u iradios git rev-parse --short HEAD)"

echo "[ENV] Checking external stage secrets and preparing Git-ignored .env links..."
bash ops/ensure-stage-env.sh

echo "[2/5] Cleaning temporary staging build output..."
# Do not run git clean -fdx: it would delete restored, untracked logo PNGs.
# Do not delete node_modules, uploads, Docker volumes, backups or /etc secrets.
for rel in \
  frontend/dist \
  frontend/dist-ssr \
  frontend/.vite \
  frontend/node_modules/.vite \
  frontend/node_modules/.cache \
  backend/dist \
  backend/.cache
do
  if [[ "$rel" == frontend/node_modules/* && -L "$APP/frontend/node_modules" ]]; then
    echo "  Skipping cache under symlinked node_modules"
    continue
  fi
  target="$APP/$rel"
  if [[ -d "$target" || -L "$target" ]]; then
    echo "  Removing $rel"
    rm -rf -- "$target"
  fi
done

echo "[3/5] Building and deploying STAGING containers..."
# Remember only old stage-created app images for a *targeted* later cleanup.
old_backend=$(docker image inspect iradios_stage-backend:latest --format '{{.Id}}' 2>/dev/null || true)
old_frontend=$(docker image inspect iradios_stage-frontend:latest --format '{{.Id}}' 2>/dev/null || true)

if [[ "$FRESH" == 1 ]]; then
  echo "  Fresh build: Docker layer cache will not be used."
  IRADIOS_STAGE_NO_CACHE=1 bash ops/deploy-stage.sh
else
  bash ops/deploy-stage.sh
fi

echo "[4/5] Removing unused older staging app images only..."
remove_old_stage_image() {
  local old="$1" name="$2" current
  [[ -n "$old" ]] || return 0
  current=$(docker image inspect "$name:latest" --format '{{.Id}}' 2>/dev/null || true)
  [[ -n "$current" && "$old" != "$current" ]] || return 0
  # Never remove an image referenced by any (including stopped) container.
  if [[ -n "$(docker ps -aq --filter "ancestor=$old")" ]]; then
    echo "  Keeping image still referenced by a container: $name"
    return 0
  fi
  if docker image rm "$old" >/dev/null 2>&1; then
    echo "  Removed obsolete $name image"
  else
    echo "  Kept $name image (other references/tags may exist)"
  fi
}
remove_old_stage_image "$old_backend" iradios_stage-backend
remove_old_stage_image "$old_frontend" iradios_stage-frontend

echo "[5/5] Final checks..."
curl --fail --silent --show-error --max-time 10 \
  http://127.0.0.1:5511/api/health
echo
curl --fail --silent --show-error --max-time 10 \
  http://127.0.0.1:5510/ >/dev/null

if [[ -f "$APP/frontend/public/noicon-iradios-app-logo.png" ]]; then
  if [[ -f ops/check-stage-branding.sh ]]; then
    bash ops/check-stage-branding.sh || \
      echo "WARNING: branding image check failed; verify static PNGs in browser."
  fi
else
  echo "WARNING: original sidebar logo missing in frontend/public."
  echo "         Restore it with: sudo bash ops/restore-stage-branding.sh"
fi

echo "=========================================================="
echo "  UPDATE COMPLETE | $(sudo -u iradios git rev-parse --short HEAD)"
echo "  https://stage.iradios.gr"
echo "=========================================================="
