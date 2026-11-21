#!/usr/bin/env bash
# Fail the deployment if critical billing code is missing/stale in the actual
# running BACKEND container. The PHP Gateway is audited by its separate guard.
# Read-only: checks exact source hashes, never env values or databases.
set -Eeuo pipefail
env="${1:-}"
case "$env" in
  staging)
    app=/srv/iradios/staging/app
    container=iradios_stage-backend-1
    ;;
  production)
    app=/srv/iradios/production/app
    container=iradios_prod-backend-1
    ;;
  *) echo "Usage: bash ops/check-backend-source-image.sh staging|production" >&2; exit 2 ;;
esac
[[ "$(id -u)" == "0" ]] || { echo "STOP: run with sudo" >&2; exit 1; }
cd "$app"
files=(
  services/gatewayEnvironment.js
  services/gatewayCustomerIdentity.js
  services/gatewayBillingProtocol.js
  services/broadcasterPaymentProtocol.js
  services/advertisingPaymentEvents.js
  services/ilumaGatewayClient.js
  controllers/gatewayBillingController.js
  controllers/broadcasterBillingController.js
  scripts/checkGatewayWebhookKey.cjs
)
for file in "${files[@]}"; do
  git -c safe.directory="$PWD" cat-file -e "HEAD:backend/$file" || {
    echo "STOP: Git commit is missing critical backend file: $file" >&2; exit 1;
  }
  expected=$(git -c safe.directory="$PWD" show "HEAD:backend/$file" | sha256sum | cut -d' ' -f1)
  observed=$(docker exec "$container" sha256sum "/app/$file" 2>/dev/null | cut -d' ' -f1) || {
    echo "STOP: critical backend file missing in $env container: $file" >&2; exit 1;
  }
  [[ "$expected" == "$observed" ]] || {
    echo "STOP: stale/different backend source in $env container: $file" >&2
    exit 1
  }
done
echo "PASS: $env billing backend source matches reviewed Git HEAD"
