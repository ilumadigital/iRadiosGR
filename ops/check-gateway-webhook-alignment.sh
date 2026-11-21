#!/usr/bin/env bash
# Read-only exact signer/receiver comparison. Never prints credentials or hashes.
# Requires the reviewed diagnostic scripts in both rebuilt containers.
set -Eeuo pipefail
mode="${1:-staging}"
case "$mode" in
 staging) backend=iradios_stage-backend-1 ;;
 production) backend=iradios_prod-backend-1 ;;
 *) echo "Usage: sudo bash ops/check-gateway-webhook-alignment.sh staging|production" >&2; exit 2 ;;
esac
[[ "$(id -u)" -eq 0 ]] || { echo "STOP: use sudo" >&2; exit 1; }
gateway_output=$(docker exec iluma_gateway-php-1 php bin/check-webhook-signing.php "$mode") || {
 echo "STOP: Gateway signer diagnostic missing/unavailable" >&2; exit 1;
}
backend_output=$(docker exec "$backend" node scripts/checkGatewayWebhookKey.cjs) || {
 echo "STOP: iRadios receiver diagnostic missing/unavailable" >&2; exit 1;
}
sender=$(sed -n "s/^${mode^^} GATEWAY_OUTBOX_HMAC_PROOF=\([a-f0-9]\{24\}\)$/\1/p" <<< "$gateway_output")
receiver=$(sed -n "s/^${mode^^} IRADIOS_RECEIVER_HMAC_PROOF=\([a-f0-9]\{24\}\)$/\1/p" <<< "$backend_output")
if [[ -z "$sender" || -z "$receiver" ]]; then
 echo "STOP: missing HMAC proof; no secrets printed" >&2;exit 1
fi
if [[ "$sender" != "$receiver" ]]; then
 echo "FAIL: $mode Gateway signer and iRadios receiver use DIFFERENT secrets" >&2
 echo "ACTION: reconcile ONLY the $mode key pair in the approved credentials workflow" >&2
 exit 1
fi
echo "PASS: $mode current outbox signer and backend receiver secrets are aligned"
if [[ "$mode" == production ]]; then
 echo "NOTICE: this does NOT validate the pinned old key or the 3 legacy stage-routed pending events"
fi
