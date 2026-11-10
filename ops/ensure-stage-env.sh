#!/usr/bin/env bash
# ILUMA: bind the usual .env filenames to the real Hostinger-only staging secrets.
# Do NOT copy credentials into the Git checkout, Docker image, or public assets.
# These links are ignored by Git; existing credentials are never overwritten.
set -Eeuo pipefail
umask 077

APP=/srv/iradios/staging/app
COMPOSE_ENV=/etc/iradios/staging/compose.env
BACKEND_ENV=/etc/iradios/staging/backend.env

[[ "$(id -u)" == "0" ]] || {
  echo "Run as root: sudo bash ops/ensure-stage-env.sh" >&2
  exit 1
}
[[ -d "$APP/.git" && -f "$APP/compose.stage.yml" ]] || {
  echo "STOP: expected stage checkout missing." >&2
  exit 1
}

check_secret() {
  local source="$1" label="$2" mode uid
  [[ -f "$source" && ! -L "$source" ]] || {
    echo "STOP: missing or unsafe $label at $source" >&2
    exit 1
  }
  mode=$(stat -c '%a' "$source")
  uid=$(stat -c '%u' "$source")
  [[ "$mode" == 600 && "$uid" == 0 ]] || {
    echo "STOP: $source must be owned by root and chmod 600." >&2
    exit 1
  }
}

check_secret "$COMPOSE_ENV" "Compose stage secret file"
check_secret "$BACKEND_ENV" "Backend stage secret file"

# Do not regenerate Mongo/JWT credentials of an already working installation.
for key in STAGE_MONGO_PASSWORD STAGE_MONGO_APP_PASSWORD; do
  grep -Eq "^$key=.+" "$COMPOSE_ENV" || {
    echo "STOP: $key missing from Compose stage env." >&2; exit 1;
  }
done
for key in JWT_SECRET SMTP_HOST SMTP_PORT; do
  grep -Eq "^$key=.+" "$BACKEND_ENV" || {
    echo "STOP: $key missing from backend stage env." >&2; exit 1;
  }
done
if ! grep -qx 'APP_ENV=staging' "$BACKEND_ENV"; then
  echo "STOP: backend.env must have APP_ENV=staging." >&2
  exit 1
fi

# Validate stage-only SMTP and Nexi Sandbox restrictions before creating links or building images.
bash "$APP/ops/check-stage-backend-env.sh" "$BACKEND_ENV"

cd "$APP"
# The checkout is owned by 'iradios', not root. Perform Git checks as owner.
sudo -u iradios git rev-parse --is-inside-work-tree >/dev/null
for link in .env backend/.env; do
  if sudo -u iradios git ls-files --error-unmatch -- "$link" >/dev/null 2>&1; then
    echo "STOP: $link is tracked by Git! Do not link secrets into tracked paths." >&2
    exit 1
  fi
done

ensure_link() {
  local link="$1" source="$2"
  if [[ -L "$link" ]]; then
    [[ "$(readlink -- "$link")" == "$source" ]] || {
      echo "STOP: $link points somewhere unexpected. No changes made." >&2
      exit 1
    }
    echo "OK: $link -> $source"
  elif [[ -e "$link" ]]; then
    echo "STOP: $link is a regular file/directory; refusing to replace it." >&2
    exit 1
  else
    ln -s -- "$source" "$link"
    echo "Created: $link -> $source"
  fi
}

ensure_link .env "$COMPOSE_ENV"
ensure_link backend/.env "$BACKEND_ENV"

for link in .env backend/.env; do
  if ! sudo -u iradios git check-ignore -q "$link"; then
    echo "STOP: Git does not ignore $link; update .gitignore before proceeding." >&2
    exit 1
  fi
done

# The Compose env and backend env are intentionally separate:
# the backend must NOT receive the MongoDB root/admin credential.
# Frontend VITE_* variables are public build-time values, not backend secrets.
[[ ! -e frontend/.env && ! -L frontend/.env ]] || {
  echo "WARNING: frontend/.env exists. Never place a secret in a VITE_* variable." >&2
}

echo "Stage .env links are ready. Docker Compose reads the real files directly."
echo "Git ignores both local links. Secret contents were not printed."
