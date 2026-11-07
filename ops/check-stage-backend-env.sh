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
# Staging accepts legacy/existing billing credentials but NEVER uses them.
# Payment endpoints are blocked by server.js and paymentController never
# initializes a Stripe client under APP_ENV=staging.
# Keep this check limited to syntax and duplicates; never log secrets.
if ! grep -Eq '^STRIPE_SECRET_KEY=(sk_live_|sk_test_)[^[:space:]]+$' "$ENV_FILE"; then
  echo 'STOP: STRIPE_SECRET_KEY must be one nonempty, unquoted Stripe secret key.' >&2
  exit 1
fi
if ! grep -Eq '^STRIPE_WEBHOOK_SECRET=[^[:space:]]+$' "$ENV_FILE"; then
  echo 'STOP: STRIPE_WEBHOOK_SECRET must be nonempty and unquoted.' >&2
  exit 1
fi
for key in SMTP_HOST SMTP_PORT; do
  if ! grep -Eq "^${key}=[^[:space:]]+$" "$ENV_FILE"; then
    echo "STOP: $key must be nonempty and unquoted." >&2
    exit 1
  fi
done
# Staging mailer forces mailpit independently of these SMTP values.
if grep -Eq '^STAGE_ENABLE_ACRCLOUD=' "$ENV_FILE"; then
  if [[ "$(count_key STAGE_ENABLE_ACRCLOUD)" != "1" ]] || ! grep -Eq '^STAGE_ENABLE_ACRCLOUD=[01]$' "$ENV_FILE"; then
    echo 'STOP: STAGE_ENABLE_ACRCLOUD must be declared once as 0 or 1.' >&2
    exit 1
  fi
fi
echo 'Staging backend env safety checks passed (no values printed).'
