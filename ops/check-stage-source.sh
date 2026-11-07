#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for f in backend/.env frontend/.env .env; do
  if [[ -f "$f" ]]; then echo "Forbidden $f in app checkout" >&2; exit 1; fi
done
if grep -R -l -E '(sk_live_|pk_live_|https://play\.iradios\.gr|ghp_[a-zA-Z0-9]{20}|github_pat_[a-zA-Z0-9_]{20})' \
    backend frontend --include='*.js' --include='*.jsx' --include='*.html' --include='*.json' \
    --exclude='package-lock.json' | grep -q .; then
  echo 'Forbidden live reference in staged source' >&2; exit 1
fi
echo 'Source preflight: no obvious live Stripe keys/URLs or .env files.'
