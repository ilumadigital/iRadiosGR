#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# The only allowed .env entries in checkout are symlinks pointing to the
# root-owned /etc staging secret files. Source files or alternate targets fail.
check_env_link() {
  local link="$1" allowed="$2"
  if [[ -e "$link" || -L "$link" ]]; then
    if [[ ! -L "$link" ]] || [[ "$(readlink -- "$link")" != "$allowed" ]]; then
      echo "Forbidden unsafe .env entry: $link" >&2
      exit 1
    fi
    [[ -f "$allowed" ]] || {
      echo "Broken secret link: $link" >&2; exit 1;
    }
  fi
}
check_env_link .env /etc/iradios/staging/compose.env
check_env_link backend/.env /etc/iradios/staging/backend.env
if [[ -e frontend/.env || -L frontend/.env ]]; then
  echo "Do not create frontend/.env: frontend VITE_* values are public build args." >&2
  exit 1
fi
if grep -R -l -E '(https://play\.iradios\.gr|ghp_[a-zA-Z0-9]{20}|github_pat_[a-zA-Z0-9_]{20})' \
    backend frontend --include='*.js' --include='*.jsx' --include='*.html' --include='*.json' \
    --exclude='package-lock.json' | grep -q .; then
  echo 'Forbidden live reference in staged source' >&2; exit 1
fi
echo 'Source preflight: no known production URLs or exposed repository tokens; only expected stage .env symlinks allowed.'
