# iRadiosGR — one real Nexi Production payment from isolated staging

Status: **source-only / DISABLED / NOT DEPLOYED**. No production charge has been
attempted. This is not a change to the separate `play.iradios.gr` server or
a switch of staging into APP_ENV=production.

## Architecture

The standard iRadios staging billing still uses `ILUMA_GATEWAY_STAGING_*` and
Nexi Sandbox. A dedicated, independently gated production QA client accepts
ONLY one verified and explicitly allowlisted **staging Listener** account,
**L-PREM**, **399 EUR cents**, **one-off / no auto-renewal**. Neither Broadcaster
nor Agency campaigns may use the production QA key.

The authenticated, opt-in `POST /api/billing/production-qa/checkout` requires
`{"productSku":"L-PREM","amountCents":399,"confirmedLiveCharge":true}` and an
`Idempotency-Key` UUID v4. A distinct `ProductionQaOrder` Mongo collection,
unique per listener and globally single-run, blocks all subsequent attempts,
including an unknown/Nexi-timeout case. The UI offers a **second explicit
confirmation** and identifies the amount as a real charge.

The Gateway stores an immutable production QA marker and originating API
credential with each QA payment in its **production** tenant. It sends this
payment's HMAC-signed outbox event to the exact
`https://stage.iradios.gr/api/gateway/production-qa/webhook`, while **all
ordinary production payments and webhooks continue to play.iradios.gr**.
A normal or forged browser return never grants Premium. Only the staging
backend's verified, correlated and replay-protected production `payment.paid`
event activates the paid staging QA listener for a single month.

## Mandatory prerequisites, BEFORE editing either private ENV

1. Approve the **separate Gateway PR** and review the production DB backup and
   restoration procedure. The new Gateway migration
   `database/migrations/20261116_production_payment_qa.sql` is manual,
   production tenant only, and must be applied **before** Gateway deployment.
   Run a production backup and confirm restoration first. The migration adds
   nullable per-payment route fields and a unique one-attempt key. It does
   not change normal customer/payment data or the Sandbox tenant.
2. Verify Gateway `PRODUCTION_ENABLED=1` **and** `APP_ENV=production` are
   legitimately authorized; a "Production View" admin badge is *not* proof
   of this. Do NOT flip global merchant flags solely for this test without
   production security sign-off.
3. Verify the real production Nexi connection and that the Gateway production
   product `iRadiosGR / L-PREM` is **enabled**, `EUR 3.99` gross. No
   automatic product seeding, pricing changes or recurring MIT will occur.
4. Create a **new separate production API key exclusively for QA** in Gateway's
   production workspace (never reuse a live application production key).
   Its SHA-256 of the literal key, not its secret, goes into the Gateway
   private environment as `IRADIOS_PROD_QA_KEY_SHA256`. The raw matching
   key and secret go ONLY into staging `backend.env`.
5. Use a dedicated VERIFIED `user` role test Listener on staging. Its ObjectId
   must be identical in **both** private environments:
   `IRADIOS_PROD_QA_LISTENER_ID`. Never use a normal customer's account.
6. Ensure the real production Nexi worker and webhook notification/outbox
   delivery are operating. Preserve `IRADIOS_PRODUCTION_WEBHOOK` =
   `https://play.iradios.gr/api/gateway/webhook`. A real card can be charged
   even if the callback fails; do not assume lack of UI success means no charge.

## Gateway private ENV (Gateway host, operator-only)

```dotenv
# Existing production Gateway flags MUST have been separately approved.
IRADIOS_PROD_QA_CHECKOUT_ENABLED=0
IRADIOS_PROD_QA_KEY_SHA256=<sha256-of-dedicated-qa-production-key>
IRADIOS_PROD_QA_LISTENER_ID=<24-hex-test-listener-objectid>
IRADIOS_PROD_QA_WEBHOOK=https://stage.iradios.gr/api/gateway/production-qa/webhook
# Keep IRADIOS_PRODUCTION_WEBHOOK on https://play.iradios.gr/api/gateway/webhook
```

Leave checkout flag `0` for deployment and preflight. Only after CI,
the migration, actual deployment, product check and mutual QA readiness
may the operator separately authorize changing it to `1`.

## iRadios staging private ENV (Hostinger staging VPS only)

Before deploying the new source, do not place live keys in backend.env and
leave `IRADIOS_PROD_QA_ENABLED=0`.

To run the one explicitly approved real-card checkout **after** Gateway is
ready, set in `/etc/iradios/staging/backend.env`:

```dotenv
APP_ENV=staging
IRADIOS_PROD_QA_ENABLED=1
IRADIOS_PROD_QA_CALLBACK_ONLY=0
IRADIOS_PROD_QA_LISTENER_ID=<same-24-hex-test-listener-objectid>
ILUMA_GATEWAY_PROD_KEY=<new-dedicated-qa-production-key>
ILUMA_GATEWAY_PROD_SECRET=<matching-64-hex-hmac-secret>
```

Do not overwrite any existing JWT, MongoDB, Turnstile, SMTP, Sandbox billing
or Ad v2 settings. No production key enters Vite, frontend, logs, Git or the
ordinary sandbox client.

Validate privately, without printing credentials:

```bash
cd /srv/iradios/staging/app
sudo bash ops/check-stage-backend-env.sh /etc/iradios/staging/backend.env
sudo ./ilumadev.sh
```

In `https://stage.iradios.gr/premium` sign in as the single allowlisted,
verified test Listener. Only this account sees **Nexi Production QA**.
Read the real-charge disclosure, confirm the actual EUR 3.99 charge, and
visit the real Nexi hosted payment page. After the provider return, use the
QA status button. Check Gateway payment history, provider settlement,
the exact SKU and cents, that the signed outbox went to the QA callback,
that exactly ONE `ProductionQaOrder` became `paid`, and that the staging
test Listener gained `listener.premium`. Replays must not extend its paid
period. Test failure/unknown and callback-503 recovery off-line or with
synthetic fixtures; never generate fresh real charges to force these states.

## Stop new charges without losing a pending callback

1. Set Gateway `IRADIOS_PROD_QA_CHECKOUT_ENABLED=0` (leave its pinned
   QA webhook and dedicated credential active for the existing outbox).
2. Staging, while an outbox might still be pending:
   ```dotenv
   IRADIOS_PROD_QA_ENABLED=0
   IRADIOS_PROD_QA_CALLBACK_ONLY=1
   # keep PROD_KEY, PROD_SECRET and exact LISTENER_ID until webhook settles
   ```
   Re-run staging ENV preflight and `./ilumadev.sh`.
3. Reconcile Gateway history, Nexi provider status and staging QA receipt.
   Only once no delivery is pending, deactivate the dedicated QA API key and
   remove the PROD key and secret from staging ENV, set
   `IRADIOS_PROD_QA_CALLBACK_ONLY=0`, then deploy.
4. A real charge is **not** automatically refunded by switching off QA.
   Use the documented provider/admin refund and accounting process if
   cancellation/refund is needed. Never delete a payment ledger to retry.

## Non-negotiable release gate

Production QA source is intentionally disabled and no live transaction is
executed by CI. Source checks cannot prove Nexi Production success or
Gateway worker availability. PR merge is not server deployment. The separate
`play.iradios.gr` server is **not touched**. Never run a real-card checkout
until the operator has explicitly approved the actual payment test.
