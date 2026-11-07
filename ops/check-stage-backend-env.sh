#!/usr/bin/env bash
# Offline-safe staging environment guard: reads values, never prints values.
# Never source a .env: source can execute arbitrary shell commands.
set -Eeuo pipefail
ENV_FILE="${1:-/etc/iradios/staging/backend.env}"
[[ -f "$ENV_FILE" && ! -L "$ENV_FILE" ]] || { echo 'STOP: staging backend.env missing or is a symlink.' >&2; exit 1; }
count_key() { grep -Ec "^${1}=" "$ENV_FILE" || true; }
for key in APP_ENV STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET SMTP_HOST SMTP_PORT; do
  if [[ "$(count_key "$key")" != "1" ]]; then
    echo "STOP: staging backend.env must define $key exactly once." >&2
    exit 1
  fi
done
if ! grep -qx 'APP_ENV=staging' "$ENV_FILE"; then
  echo 'STOP: this file is not configured for staging.' >&2
  exit 1
fi
if ! grep -qx 'STRIPE_SECRET_KEY=sk_test_disabled_no_payments' "$ENV_FILE"; then
  echo 'STOP: staging must use the non-live, disabled Stripe placeholder.' >&2
  exit 1
fi
if ! grep -qx 'STRIPE_WEBHOOK_SECRET=whsec_disabled' "$ENV_FILE"; then
  echo 'STOP: staging must use the disabled Stripe webhook placeholder.' >&2
  exit 1
fi
if ! grep -qx 'SMTP_HOST=mailpit' "$ENV_FILE" || ! grep -qx 'SMTP_PORT=1025' "$ENV_FILE"; then
  echo 'STOP: staging mail delivery must go to internal mailpit:1025.' >&2
  exit 1
fi
if grep -Eq '^SMTP_(USER|PASS)=.+' "$ENV_FILE"; then
  echo 'STOP: remove production SMTP credentials from the staging file.' >&2
  exit 1
fi
if grep -Eq '^STAGE_ENABLE_ACRCLOUD=' "$ENV_FILE"; then
  if [[ "$(count_key STAGE_ENABLE_ACRCLOUD)" != "1" ]] || ! grep -Eq '^STAGE_ENABLE_ACRCLOUD=[01]$' "$ENV_FILE"; then
    echo 'STOP: STAGE_ENABLE_ACRCLOUD must be declared once as 0 or 1.' >&2
    exit 1
  fi
fi
echo 'Staging backend env safety checks passed (no values printed).'
