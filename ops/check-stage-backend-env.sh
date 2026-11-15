#!/usr/bin/env bash
# Offline-safe staging environment guard: reads values, never prints values.
# Never source a .env: source can execute arbitrary shell commands.
set -Eeuo pipefail
ENV_FILE="${1:-/etc/iradios/staging/backend.env}"
[[ -f "$ENV_FILE" && ! -L "$ENV_FILE" ]] || { echo 'STOP: staging backend.env missing or is a symlink.' >&2; exit 1; }
count_key() { grep -Ec "^${1}=" "$ENV_FILE" || true; }
for key in APP_ENV SMTP_HOST SMTP_PORT; do
  if [[ "$(count_key "$key")" != "1" ]]; then
    echo "STOP: staging backend.env must define $key exactly once." >&2
    exit 1
  fi
done
if ! grep -qx 'APP_ENV=staging' "$ENV_FILE"; then
  echo 'STOP: this file is not configured for staging.' >&2
  exit 1
fi
for key in SMTP_HOST SMTP_PORT; do
  if ! grep -Eq "^${key}=[^[:space:]]+$" "$ENV_FILE"; then
    echo "STOP: $key must be nonempty and unquoted." >&2
    exit 1
  fi
done
# All staging SMTP, including Admin OTP, must stay inside Mailpit.
if ! grep -qx 'SMTP_HOST=mailpit' "$ENV_FILE" ||
   ! grep -qx 'SMTP_PORT=1025' "$ENV_FILE"; then
  echo 'STOP: staging SMTP must be internal Mailpit:1025.' >&2
  exit 1
fi
for key in SMTP_USER SMTP_PASS ADMIN_2FA_SMTP_HOST ADMIN_2FA_SMTP_PORT ADMIN_2FA_SMTP_USER ADMIN_2FA_SMTP_PASS ADMIN_2FA_SMTP_FROM; do
  if grep -Eq "^$key=[^[:space:]]" "$ENV_FILE"; then
    echo "STOP: external SMTP configuration forbidden ($key)." >&2
    exit 1
  fi
done
if grep -Eq '^STAGE_ENABLE_SONOVAULT=' "$ENV_FILE"; then
  if [[ "$(count_key STAGE_ENABLE_SONOVAULT)" != "1" ]] || ! grep -Eq '^STAGE_ENABLE_SONOVAULT=[01]$' "$ENV_FILE"; then
    echo 'STOP: STAGE_ENABLE_SONOVAULT must be declared once as 0 or 1.' >&2
    exit 1
  fi
fi
# Staging auth requires a real Cloudflare Turnstile widget, never demo keys.
for key in TURNSTILE_SITE_KEY TURNSTILE_SECRET_KEY; do
  if [[ "$(count_key "$key")" != "1" ]] ||
     ! grep -Eq "^${key}=[^[:space:]]+$" "$ENV_FILE"; then
    echo "STOP: configure real $key exactly once for Cloudflare Turnstile." >&2
    exit 1
  fi
  if grep -Eq "^${key}=[123]x0{16}" "$ENV_FILE"; then
    echo "STOP: Cloudflare test keys are not permitted on public staging ($key)." >&2
    exit 1
  fi
done
# Nexi Sandbox is an explicit staging-only opt-in; never echo secret values.
if grep -Eq '^ILUMA_GATEWAY_PRODUCTION_(KEY|SECRET)=' "$ENV_FILE"; then
  echo 'STOP: production Gateway credentials are forbidden on staging.' >&2
  exit 1
fi
if grep -q '^IRADIOS_BILLING_SANDBOX_ENABLED=' "$ENV_FILE"; then
  if [[ "$(count_key IRADIOS_BILLING_SANDBOX_ENABLED)" != "1" ]] ||
    ! grep -Eq '^IRADIOS_BILLING_SANDBOX_ENABLED=[01]$' "$ENV_FILE"; then
    echo 'STOP: IRADIOS_BILLING_SANDBOX_ENABLED must be 0 or 1 exactly once.' >&2
    exit 1
  fi
  if grep -qx 'IRADIOS_BILLING_SANDBOX_ENABLED=1' "$ENV_FILE"; then
    if [[ "$(count_key ILUMA_GATEWAY_STAGING_KEY)" != "1" ]] ||
      [[ "$(count_key ILUMA_GATEWAY_STAGING_SECRET)" != "1" ]] ||
      ! grep -Eq '^ILUMA_GATEWAY_STAGING_KEY=ilg_[a-f0-9]{48}$' "$ENV_FILE" ||
      ! grep -Eq '^ILUMA_GATEWAY_STAGING_SECRET=[a-f0-9]{64}$' "$ENV_FILE"; then
      echo 'STOP: sandbox checkout requires staging Gateway key and raw HMAC secret.' >&2
      exit 1
    fi
  fi
fi
# Production-like event accounting is separate from live Nexi merchant mode.
# Keep the switch explicit and reject incomplete activation before a build.
if grep -q '^ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=' "$ENV_FILE"; then
  if [[ "$(count_key ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED)" != "1" ]] ||
     ! grep -Eq '^ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=[01]# Gateway setting. Omitted means zero days (no unapproved free extension).
if grep -q '^IRADIOS_BILLING_GRACE_DAYS=' "$ENV_FILE"; then
  if [[ "$(count_key IRADIOS_BILLING_GRACE_DAYS)" != "1" ]] ||
     ! grep -Eq '^IRADIOS_BILLING_GRACE_DAYS=([0-9]|1[0-4])$' "$ENV_FILE"; then
    echo 'STOP: IRADIOS_BILLING_GRACE_DAYS must be a single integer 0..14.' >&2
    exit 1
  fi
fi
echo 'Staging backend env safety checks passed (no values printed).'
 "$ENV_FILE"; then
    echo 'STOP: Advertising v2 financial switch must occur once as 0 or 1.' >&2
    exit 1
  fi
fi
check_private_secret() {
  local key="$1" value
  if [[ "$(count_key "$key")" != "1" ]]; then
    echo "STOP: configure $key exactly once in private backend.env." >&2
    exit 1
  fi
  value=$(sed -n "s/^$key=//p" "$ENV_FILE")
  if [[ ${#value} -lt 32 || "$value" =~ [[:space:]] ]]; then
    echo "STOP: $key must be a nonempty, single-line secret of 32+ characters." >&2
    exit 1
  fi
}
if grep -qx 'ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=1' "$ENV_FILE"; then
  if ! grep -qx 'IRADIOS_BILLING_SANDBOX_ENABLED=1' "$ENV_FILE"; then
    echo 'STOP: paid event delivery needs verified sandbox Gateway funding enabled.' >&2
    exit 1
  fi
  check_private_secret ADVERTISING_V2_DELIVERY_SECRET
  check_private_secret IRADIOS_TRUSTED_GEO_SECRET
  # Do not let historical QA compatibility flags override paid behavior.
  for key in AD_STAGE_QA_APPROVAL_ENABLED AD_STAGE_PAID_PLACEMENT_PREVIEW; do
    if grep -qx "$key=1" "$ENV_FILE"; then
      echo "STOP: $key cannot coexist with v2 financial delivery." >&2
      exit 1
    fi
  done
fi
# Days of grace are a deliberate iRadios subscription policy, not a
# Gateway setting. Omitted means zero days (no unapproved free extension).
if grep -q '^IRADIOS_BILLING_GRACE_DAYS=' "$ENV_FILE"; then
  if [[ "$(count_key IRADIOS_BILLING_GRACE_DAYS)" != "1" ]] ||
     ! grep -Eq '^IRADIOS_BILLING_GRACE_DAYS=([0-9]|1[0-4])$' "$ENV_FILE"; then
    echo 'STOP: IRADIOS_BILLING_GRACE_DAYS must be a single integer 0..14.' >&2
    exit 1
  fi
fi
echo 'Staging backend env safety checks passed (no values printed).'
