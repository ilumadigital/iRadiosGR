# iRadiosGR Billing Phase 3 — First-period Nexi Sandbox UAT (2026-11-10)

**Release policy:** Staging only. No real charges, no card numbers stored, no automated subscription renewals. Phase 3 covers ONLY `L-PREM` at **EUR 3.99 incl. VAT 24%**, for one initial calendar-month entitlement period.

## Implemented application contract

```
Verified listener (JWT)
 -> POST /api/billing/checkout (Idempotency-Key UUID, JSON {})
 -> one Mongo BillingOrder with unique account/SKU open lock
 -> backend-only HMAC POST to https://gateway.iluma.gr/api/v1/payments/checkout
 -> Gateway Staging product L-PREM 399 EUR, Nexi Sandbox Hosted Payment Page
 -> browser follows Nexi HPP URL (host allowlist)
 -> Nexi redirects browser to Gateway /checkout/result or /checkout/cancel
 -> Gateway verifies the existing order using server-to-server Nexi GET and
    HTTP 303 redirects ONLY to stage.iradios.gr/premium?gateway_return=...&order=...
 -> Nexi notifies Gateway; Gateway independently reconciles the captured payment
 -> Gateway worker signs outgoing event to POST https://stage.iradios.gr/api/gateway/webhook
 -> iRadios verifies HMAC raw body, event ID, 5-minute clock, nonce index,
    staging environment, amount=399, payment_id and order_id owned by local intent
 -> atomic BillingOrder state update (first-period paid, calendar-month end, event id)
 -> /auth/me projects Listener Premium entitlement until paid period end, or
    until a separately configured iRadios grace limit if deliberately enabled
```

Redirect, provider checkout response or a client-entered payment ID **never** activate Premium. Only a verified `payment.paid` webhook does. The Gateway event's `customer_id` is an **internal Gateway customer ID**, NOT the iRadios user id.

### API routes

- `GET /api/billing/catalog`: published 21-item price catalog.
- `POST /api/billing/checkout`: verified Listener JWT, `Idempotency-Key` UUID v4, body `{}`. No caller-selected price, SKU or customer ID.
- `GET /api/billing/me/orders`: own initial payment attempts and status.
- `GET /api/billing/orders/{id}?refresh=1`: own intent. Optional signed read-only Gateway status query; **cannot** activate service without webhook.
- `POST /api/gateway/webhook`: Gateway worker only, raw application/json + HMAC, no JWT or `X-Iluma-Key`. The code is mounted **before** JSON parsing and the staging JWT access middleware.
- `GET /api/admin/billing/sandbox-orders`: admin JWT only, payment/status/event history (read-only).
- Backoffice UI: `/backoffice/admin/billing/sandbox` and `/backoffice/admin/billing/grants`.
- Listener UI: `/premium` on `stage.iradios.gr` only, never a deprecated checkout flow.

## Preconditions (manual server configuration — do not commit secrets)

1. Merge only after full offline CI passes; deploy the **staging** branch with the existing guarded staging deploy script. Do not touch play.iradios.gr or ILUMA live credentials.
2. In `gateway.iluma.gr/ilm-admin`, ensure that the iRadios application **staging** product SKU `L-PREM` is enabled at exactly `399` euro cents, currency EUR (Gateway admin product catalog). This is distinct from the CLI-only `sandbox-subscription listener-002` experiment, and the two idempotency references must not be mixed.
3. Register a Gateway **staging** API key for the iRadios app. The Gateway code generates `ilg_` plus 48 lowercase hex for the key, and a **64-digit lowercase hex raw string** for its secret. Store the key/secret securely, not in Git, Vite, browser, the Gateway frontend, logs, or spreadsheets. Ensure the Gateway worker signs with **the same currently active staging secret** used by the iRadios backend. If multiple credentials are active, review/rotate and disable older entries as needed.
4. On the iRadios host, edit `/etc/iradios/staging/backend.env` (owner-only `0600`, not tracked):
   ```dotenv
   APP_ENV=staging
   IRADIOS_BILLING_SANDBOX_ENABLED=1
   IRADIOS_BILLING_GRACE_DAYS=0
   ILUMA_GATEWAY_STAGING_KEY=ilg_REPLACE_WITH_STAGING_KEY
   ILUMA_GATEWAY_STAGING_SECRET=REPLACE_WITH_RAW_HEX_STAGING_SECRET
   ```
   Keep existing Mongo/JWT/SMTP values intact. If the staging key is not ready, leave `IRADIOS_BILLING_SANDBOX_ENABLED=0` and do **not** attempt checkout.
5. On the Gateway host, configure `IRADIOS_STAGING_WEBHOOK=https://stage.iradios.gr/api/gateway/webhook` in private Gateway environment and restart its worker as needed. Never target `play.iradios.gr`. The staging Nginx `/api/` location already proxies to the backend and has HTTP Basic Auth disabled. If Cloudflare is enabled, permit authenticated machine-to-machine POST delivery to this **one** path without opening admin/private account paths; keep TLS verification, rate controls and HMAC validation.
6. Make sure the iRadios staging Mongo user can create the **new** `billingorders` and `gatewaywebhooknonces` indexes. Checkout and webhooks explicitly fail closed if unique indexes cannot be created.
7. Use a dedicated, verified, staging-only Listener test account. Avoid imported real production users and real email addresses for paid testing.

### Safe validation steps

1. On the host run `bash ops/check-stage-backend-env.sh /etc/iradios/staging/backend.env` — never print the secret values.
2. Run offline tests (`node --test backend/tests/billingGatewayProtocol.test.js ops/check-billing-gateway-webhook.test.cjs`) and the complete staging CI; verify health and existing station/player features after deploy.
3. Sign in with a verified Listener test account at `https://stage.iradios.gr/premium`. Confirm 3.99 EUR, VAT included, no automatic renewal. Click *Συνέχεια στη Nexi Sandbox*. Ensure the browser goes to `https://*.nexigroup.com/` (not to an arbitrary URL).
4. Complete payment with **official Nexi Sandbox test card data only**, never a real card. The browser returns through Gateway to the same iRadios Premium page for both result and cancellation; URL flags alone are NOT payment confirmation.
5. Run the Gateway staging worker `php bin/work.php staging` (per scheduled deployment), or confirm its cron job is active. Inspect only non-sensitive delivery status. A delivered event must return HTTP 2xx; an invalid signature must be HTTP 401; a bad payment correlation must return HTTP 503 for retry.
6. In iRadios, select *Έλεγχος κατάστασης*; verify `active` only after the authenticated `payment.paid` webhook. Refresh `/api/auth/me` and confirm projected `isPremium: true` and `billingEntitlements: ['listener.premium']` while the period is active. No deprecated processor payment, no card data, no synthetic `Transaction` record.
7. In the Admin Backoffice read `/backoffice/admin/billing/sandbox`: expected order/payment IDs, 399 cents, `active`, exactly one successful paid activation, event log and period expiry. Existing complimentary Admin grants remain separate.
8. Repeat the webhook with **the same event ID but a new valid signed nonce** (from a controlled staging fixture): the period end must not change. Replay an identical nonce: HTTP 409. Tamper amount, event_id, environment, signature or order/payment association: no Premium activation. A provider status of `unknown` must NOT create a second checkout.
9. Verify next-month expiry by adjusting test fixtures/offline clock or using an isolated test record; do not manipulate imported user subscriptions. Confirm expired rights are removed on the next entitlement read while legacy complimentary/manual rights remain independent.

## Known limitations and blockers

- The Gateway supports a **one-time Hosted Payment Page**, not consented tokenized MIT renewal. The first paid period is iRadios-owned and **autoRenew=false**. Gateway `subscriptions/renew`, `subscriptions/cancel`, `subscriptions/sync`, `payment-methods/replace` remain HTTP 501.
- No real provider/sandbox UAT was performed merely by opening this PR. CI is offline-only and tests synthetic signed events, not merchant credentials, real Nexi 3DS, real Cloudflare delivery, or actual Mongo concurrency.
- If Gateway checkout is `unknown`, the local intent stays locked to prevent double charge. Do **not** manually submit a second purchase with a new idempotency key. Reconcile the original order before any safe recovery.
- If the Gateway returns definite HTTP 422 for missing/invalid product registration, the local checkout is marked failed without a charge and is safe to retry only after the staging product is corrected.
- Staging test with a real database and signed webhooks is mandatory before declaring Phase 3 finished. Keep `IRADIOS_BILLING_SANDBOX_ENABLED=0` until ready.
- Production activation requires separate approval, full business plan migration and recurring MIT tests, and is not part of this PR.

## Subscription authority and grace policy

- **Nexi** captures the card payment through its Hosted Payment Page. The card number and CVV never reach iRadios or Gateway.
- **ILUMA Gateway** owns the financial payment ID, signed provider confirmation, audit history and delivery of authenticated payment webhooks. Its browser return always redirects to the environment-fixed iRadios Premium page (303), never to a user-supplied URL.
- **iRadios** owns listener account scope, SKU L-PREM, monthly entitlement start/end, optional grace days, subscription expiry and all Premium decisions. The Gateway return URL is not sufficient to unlock benefits.
- `IRADIOS_BILLING_GRACE_DAYS=0` is the default; set to an explicitly approved integer 1-14 in the staging backend env only if there is a defined commercial grace policy. Its deadline is persisted when the signed `payment.paid` event is processed. Premium expires immediately after the paid period plus that grace; no grace is inferred from an unconfirmed charge.
- The first month is one-time **without auto renewal**, because gateway MIT/tokenization remains locked. Do not advertise automatic renewal until recurring consent, payment method vaulting and dunning are integrated and tested separately.
- Historical `unknown` payments (including the first attempt of a test listener) must be reconciled against their original Gateway order ID. Never delete the original payment ledger or reinitiate a new provider charge merely because the card page did not appear.
