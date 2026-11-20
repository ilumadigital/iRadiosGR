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
# Admin 2FA needs real SMTP before redeploy; generic staging mail uses Mailpit.
for key in ADMIN_2FA_SMTP_HOST ADMIN_2FA_SMTP_PORT ADMIN_2FA_SMTP_USER ADMIN_2FA_SMTP_PASS ADMIN_2FA_SMTP_FROM; do
  if [[ "$(count_key "$key")" != "1" ]] ||
     ! grep -Eq "^$key=[^[:space:]]+$" "$ENV_FILE"; then
    echo "STOP: configure $key for Admin email 2FA before deploying." >&2
    exit 1
  fi
done
if grep -Eiq '^ADMIN_2FA_SMTP_HOST=(mailpit|localhost|127[.][0-9.]+|::1)$' "$ENV_FILE"; then
  echo 'STOP: Admin 2FA cannot use Mailpit or loopback.' >&2
  exit 1
fi
if ! grep -Eq '^ADMIN_2FA_SMTP_PORT=[0-9]{2,5}$' "$ENV_FILE"; then
  echo 'STOP: invalid Admin 2FA SMTP port.' >&2
  exit 1
fi
# Staging mailer forces mailpit independently of these SMTP values.
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
# Payment environment is independent from APP_ENV. Keys never reach frontend.
# Legacy Sandbox installs without IRADIOS_GATEWAY_ENV remain accepted.
if [[ "$(count_key IRADIOS_GATEWAY_ENV)" -gt 1 ||
      "$(count_key IRADIOS_BILLING_ENABLED)" -gt 1 ]]; then
 echo 'STOP: duplicate payment configuration.' >&2; exit 1
fi
gateway_mode=staging
if [[ "$(count_key IRADIOS_GATEWAY_ENV)" == 1 ]]; then
 gateway_mode=$(sed -n 's/^IRADIOS_GATEWAY_ENV=//p' "$ENV_FILE")
fi
if [[ "$gateway_mode" != staging ]]; then
 echo 'STOP: staging must use IRADIOS_GATEWAY_ENV=staging; direct production Gateway/Nexi routing is forbidden.' >&2
 exit 1
fi
if grep -Eq '^ILUMA_GATEWAY_PROD_(KEY|SECRET)=' "$ENV_FILE"; then
 echo 'STOP: live Gateway credentials are forbidden in the staging backend ENV.' >&2
 exit 1
fi
if grep -q '^IRADIOS_BILLING_ENABLED=' "$ENV_FILE" &&
   ! grep -Eq '^IRADIOS_BILLING_ENABLED=[01]$' "$ENV_FILE"; then
 echo 'STOP: IRADIOS_BILLING_ENABLED must be 0 or 1.' >&2; exit 1
fi
if grep -q '^IRADIOS_BILLING_SANDBOX_ENABLED=' "$ENV_FILE"; then
 if [[ "$(count_key IRADIOS_BILLING_SANDBOX_ENABLED)" != 1 ]] ||
    ! grep -Eq '^IRADIOS_BILLING_SANDBOX_ENABLED=[01]$' "$ENV_FILE"; then
  echo 'STOP: invalid legacy sandbox flag.' >&2; exit 1
 fi
fi
if grep -Eq '^ILUMA_GATEWAY_PRODUCTION_(KEY|SECRET)=' "$ENV_FILE"; then
 echo 'STOP: obsolete production credential names are not supported.' >&2; exit 1
fi
gateway_enabled=0
if grep -qx 'IRADIOS_BILLING_ENABLED=1' "$ENV_FILE" ||
   { [[ "$gateway_mode" == staging ]] &&
     grep -qx 'IRADIOS_BILLING_SANDBOX_ENABLED=1' "$ENV_FILE"; }; then
 gateway_enabled=1
fi
if [[ "$gateway_mode" == production ]] &&
   ! grep -qx 'IRADIOS_BILLING_ENABLED=1' "$ENV_FILE"; then
 echo 'STOP: live Gateway needs explicit billing enablement.' >&2; exit 1
fi
if [[ "$gateway_enabled" == 1 ]]; then
 if [[ "$gateway_mode" == production ]]; then prefix=ILUMA_GATEWAY_PROD
 else prefix=ILUMA_GATEWAY_STAGING; fi
 for suffix in KEY SECRET; do
  key="${prefix}_${suffix}"
  if [[ "$(count_key "$key")" != 1 ]]; then
   echo "STOP: selected Gateway credential $key must appear once." >&2; exit 1
  fi
 done
 if ! grep -Eq "^${prefix}_KEY=ilg_[a-f0-9]{48}$" "$ENV_FILE" ||
    ! grep -Eq "^${prefix}_SECRET=[a-f0-9]{64}$" "$ENV_FILE"; then
  echo 'STOP: selected Gateway key/secret pair invalid.' >&2; exit 1
 fi
fi
# Paid event delivery is an explicit choice: it must never coexist with
# unticketed QA/legacy previews, production Gateway keys or missing secrets.
if grep -q '^ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=' "$ENV_FILE"; then
  if [[ "$(count_key ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED)" != "1" ]] ||
     ! grep -Eq '^ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=[01]$' "$ENV_FILE"; then
    echo 'STOP: Advertising v2 financial switch must be 0 or 1 exactly once.' >&2
    exit 1
  fi
fi
if grep -qx 'ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=1' "$ENV_FILE"; then
  if [[ "$gateway_enabled" != 1 ]]; then
    echo 'STOP: v2 billing needs a configured Gateway environment.' >&2
    exit 1
  fi
  for key in AD_STAGE_QA_APPROVAL_ENABLED AD_STAGE_PAID_PLACEMENT_PREVIEW AD_DELIVERY_BILLING_ENABLED AD_PAYMENTS_SANDBOX_ENABLED; do
    if grep -qx "$key=1" "$ENV_FILE"; then
      echo "STOP: $key cannot coexist with v2 financial delivery." >&2
      exit 1
    fi
  done
  for key in ADVERTISING_V2_DELIVERY_SECRET IRADIOS_TRUSTED_GEO_SECRET; do
    if [[ "$(count_key "$key")" != "1" ]]; then
      echo "STOP: missing private $key." >&2
      exit 1
    fi
    value=$(sed -n "s/^$key=//p" "$ENV_FILE")
    if [[ ${#value} -lt 32 || "$value" =~ [[:space:]] ]]; then
      echo "STOP: invalid $key (minimum 32 non-whitespace characters)." >&2
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
