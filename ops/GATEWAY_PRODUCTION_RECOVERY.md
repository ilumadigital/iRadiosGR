# Payment service recovery

The iRadios application stays APP_ENV=staging. Gateway production credentials
and IRADIOS_GATEWAY_ENV=production select the separate live payment tenant.
Normal staging mail remains Mailpit and Admin 2FA keeps its real SMTP.

Deploy the reviewed staging branch with sudo ./ilumadev.sh, then run:

    sudo docker exec iradios_stage-backend-1 node scripts/gateway-readiness.js

This signed GET verifies the actual key/secret pairing without a checkout,
provider request or synthetic paid event. Require READY before a real payment.
Deploy Gateway's companion readiness endpoint first; otherwise 404 is expected.

Gateway transport/preflight errors now return a payment-specific 503 JSON
response. Existing checkout catches still persist unknown results and retain
idempotency locks; this change does not retry, mark ambiguous orders failed,
grant access, or alter webhook authentication. Do not clear existing unknown
orders by hand: use their original signed read-only recovery.

Complete the Gateway VPS runbook in the companion repository:
docs/PRODUCTION_BILLING_RECOVERY.md. A healthy HTTP page alone does not prove
migrations, catalog, credential pairing, worker delivery or payment completion.
