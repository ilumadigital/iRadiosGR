# iRadios stage — commercial Gateway production mode
Do not confuse the **application environment** with the **payment tenant**.
The app remains `APP_ENV=staging`, hosted only at `stage.iradios.gr`. 
The historic `play.iradios.gr` application and its Stripe integration are not managed here.

## Operator release gates
1. Merge and deploy **Gateway** production-to-stage routing before changing payment credentials.
   Production-only Gateway migration must be backed up and applied manually.
   A separate production Gateway application credential for slug `iradiosgr` must be issued.
   Ensure Nexi production merchant is explicitly approved, correctly priced and enabled.
2. Merge this branch to iRadios `staging` then run the VPS deployment. Confirm
   staging MongoDB replica set, transactional Advertising v2 ledger, trusted GeoIP,
   pricing, budgets, outbound Gateway worker and signed callback receipt before enabling delivery.
3. Never copy real credentials into frontend, Git, logs, test fixtures or chat.
   Keep Mailpit as configured. Do not set `APP_ENV=production` on the stage VPS.

## Private staging backend.env (example; secrets intentionally omitted)
```dotenv
APP_ENV=staging
FRONTEND_URL=https://stage.iradios.gr
IRADIOS_BILLING_ENABLED=1
IRADIOS_GATEWAY_ENV=production
#ILUMA_GATEWAY_STAGING_KEY=
#ILUMA_GATEWAY_STAGING_SECRET=
ILUMA_GATEWAY_PROD_KEY=<dedicated-iradios-prod-credential>
ILUMA_GATEWAY_PROD_SECRET=<matching-raw-hmac-secret>
ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=1
AD_DELIVERY_BILLING_ENABLED=0
AD_STAGE_PAID_PLACEMENT_PREVIEW=0
AD_STAGE_QA_APPROVAL_ENABLED=0
AD_PAYMENTS_SANDBOX_ENABLED=0
```
Gateway callbacks must remain HMAC-authenticated at `https://stage.iradios.gr/api/gateway/webhook`.
The browser redirect does not grant benefits, regardless of return status.
Orders already pending in one Gateway tenant must settle before switching environments.

## Verification
```bash
cd /srv/iradios/staging/app
sudo bash ops/check-stage-backend-env.sh /etc/iradios/staging/backend.env
sudo ./ilumadev.sh
```
Validate real provider return, production tenant payment history, signed paid event,
and one and only one local funding/entitlement grant for each Listener, Broadcaster,
and Agency case. If a real checkout outcome is uncertain, reconcile by original
idempotency key and provider GET — never blindly retry a charge. Roll back
new charges by disabling `IRADIOS_BILLING_ENABLED`; preserve the credential
and callback until the Gateway outbox has no outstanding deliveries.
