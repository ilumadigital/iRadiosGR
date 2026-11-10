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
if grep -Eq '^STAGE_ENABLE_SONOVAULT=' "$ENV_FILE"; then
  if [[ "$(count_key STAGE_ENABLE_SONOVAULT)" != "1" ]] || ! grep -Eq '^STAGE_ENABLE_SONOVAULT=[01]$' "$ENV_FILE"; then
    echo 'STOP: STAGE_ENABLE_SONOVAULT must be declared once as 0 or 1.' >&2
    exit 1
  fi
fi
# Nexi Sandbox must always be an explicit opt-in. Require a STAGING-only
# HMAC credential pair when enabled, and never expose secret values in logs.
if grep -Eq '^ILUMA_GATEWAY_PRODUCTION_(KEY|SECRET)=' "$ENV_FILE"; then
  echo 'STOP: production Gateway credentials are forbidden in staging backend.env.' >&2
  exit 1
fi
if grep -q '^IRADIOS_BILLING_SANDBOX_ENABLED=' "$ENV_FILE"; then
  if [[ "$(count_key IRADIOS_BILLING_SANDBOX_ENABLED)" != "1" ]] ||
    ! grep -Eq '^IRADIOS_BILLING_SANDBOX_ENABLED=[01]
 "$ENV_FILE"; then
    echo 'STOP: IRADIOS_BILLING_SANDBOX_ENABLED must be 0 or 1 exactly once.' >&2
    exit 1
  fi
  if grep -qx 'IRADIOS_BILLING_SANDBOX_ENABLED=1' "$ENV_FILE"; then
    if [[ "$(count_key ILUMA_GATEWAY_STAGING_KEY)" != "1" ]] ||
      [[ "$(count_key ILUMA_GATEWAY_STAGING_SECRET)" != "1" ]] ||
      ! grep -Eq '^ILUMA_GATEWAY_STAGING_KEY=ilg_[a-f0-9]{48}
 "$ENV_FILE" ||
      ! grep -Eq '^ILUMA_GATEWAY_STAGING_SECRET=[a-f0-9]{64}
 "$ENV_FILE"; then
      echo 'STOP: sandbox checkout requires a valid staging Gateway key and raw HMAC secret.' >&2
      exit 1
    fi
  fi
fi
echo 'Staging backend env safety checks passed (no values printed).'
