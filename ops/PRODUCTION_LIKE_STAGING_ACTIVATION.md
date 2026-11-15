# iRadiosGR — Production-like commercial staging activation
> Operational runbook • 2026-11-15 • NEVER live Nexi / NEVER external SMTP

This branch includes the previously open PR #134 (Mailpit-only Admin OTP).
The iRadios staging environment remains `APP_ENV=staging`.
Internal charging is real (MongoDB accounting), while the payment processor is
**Gateway Sandbox** and **all mail is delivered only to internal Mailpit**.
An accepted GitHub commit or a successful CI does NOT mean VPS activation.

## 0. Required guarantees (do these in order)
1. Review the PR diff and the staging runtime, back up all root-only env files.
2. Keep `ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=0` until every other gate is verified.
3. Deploy the verified branch to stage with the documented manual `ilumadev.sh`
   process. **Do not merge or deploy with old nonempty Admin SMTP settings**.
4. Verify a tested **off-host recoverable MongoDB backup** before changing its
   topology. Do NOT delete the staging volume or replay production transactions.
5. Activate an authenticated, majority-write **single-node rs0**; test concurrency.
6. Configure Cloudflare proxied stage with **Add visitor location headers**,
   verify edge-only ingress and regional accuracy. Country-only is not
   sufficient for regional campaign charging.
7. Test actual signed Sandbox checkout/payment callback, resulting
   `nexi_verified` funding lot with `rateModel=v2_event`,
   `settlementMode=mongo_transaction_v2`, and an exact rate snapshot.
   Historic CPM lots remain read-only for v2 eligibility.
8. Supervised ticket -> actual media -> listen10/CTA/completion ->
   debit/release -> Agency analytics, with replay and exhaustion tests.
9. Only now enable v2 financial delivery and redeploy; verify full workflow.

## 1. Private environment files (all root-owned chmod 0600)
`/etc/iradios/staging/backend.env`:

```dotenv
APP_ENV=staging
SMTP_HOST=mailpit
SMTP_PORT=1025
MAIL_FROM=staging@invalid.example
IRADIOS_BILLING_SANDBOX_ENABLED=1
ILUMA_GATEWAY_STAGING_KEY=<existing staging Gateway key>
ILUMA_GATEWAY_STAGING_SECRET=<matching staging Gateway HMAC hex>
ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=0
ADVERTISING_V2_DELIVERY_SECRET=<distinct private 64-character hex>
IRADIOS_TRUSTED_GEO_SECRET=<distinct private 64-character hex>
```

Preserve all *other existing required* environment settings (JWT, VAPID,
Turnstile, API keys, etc.), do not overwrite the entire file. Leave
`ILUMA_GATEWAY_PRODUCTION_*` absent, and delete/empty
`SMTP_USER`, `SMTP_PASS` and every `ADMIN_2FA_SMTP_*` key.
External SMTP destinations are forbidden; the Admin OTP's recipient is only
a captured Mailpit header. Keep the existing Mailpit binding at
`127.0.0.1:5525`; public `/dev/mail/` must stay HTTP 403.
Do not activate `AD_PAYMENTS_SANDBOX_ENABLED` for legacy CPM unless a
separate audited payment flow explicitly requires it; v2 Gateway checkout
is controlled by the existing Gateway staging configuration.

Generate new distinct secrets **directly on the VPS, never in chat**:
```bash
sudo openssl rand -hex 32
sudo openssl rand -hex 32
```
Insert each output privately via `sudoedit /etc/iradios/staging/backend.env`;
do not send secret values to anyone.

`/etc/iradios/staging/compose.env`:
```dotenv
STAGE_AD_QA_APPROVAL_ENABLED=0
STAGE_AD_PAID_PLACEMENT_PREVIEW=0
STAGE_MONGO_RS_ENABLED=0
```
Keep the pre-existing `STAGE_MONGO_PASSWORD` and
`STAGE_MONGO_APP_PASSWORD`. Do not rotate or paste them.
Set `STAGE_MONGO_RS_ENABLED=1` **only after off-host Mongo backup has
been restored on an isolated test system** and you are ready to migrate.

Do not put private secrets in `frontend/.env` / `VITE_*`.

## 2. Safe backend and Mailpit checks
```bash
cd /srv/iradios/staging/app
sudo bash ops/check-stage-backend-env.sh /etc/iradios/staging/backend.env
node ops/check-stage-backend-env.cjs
node --test backend/tests/adminOtpMailStage.test.cjs
curl -sS -o /dev/null -w '%{http_code}\n' https://stage.iradios.gr/dev/mail/
```
Last command MUST return `403`. Confirm real Admin login OTP appears
**only in Mailpit** with authenticated SSH tunnel, not external mail.

## 3. MongoDB transaction readiness — mandatory verified backup
```bash
cd /srv/iradios/staging/app
# FIRST: independently verify and restore an OFF-HOST BACKUP of iradios_stage
# and its users/roles. Record restore procedure and a maintenance window.
# ONLY after that step:
sudoedit /etc/iradios/staging/compose.env   # STAGE_MONGO_RS_ENABLED=1
sudo env IRADIOS_STAGE_RS_MIGRATION_APPROVAL=I_VERIFIED_STAGING_BACKUP \
  bash ops/enable-stage-mongo-replicaset.sh
sudo ./ilumadev.sh
curl -fsS http://127.0.0.1:5511/api/advertising/v2/status
```
Check that `mongoReplicaSetReady` is true and `mongoReason=ok`.
Do not change the MongoDB volume or enable paid delivery if backup,
migration, authentication or writable-primary verification fails.

## 4. Cloudflare reverse proxy for trusted geo
**Prerequisites:** Cloudflare is authoritative and `stage.iradios.gr` is
Proxied, Full (strict) TLS; Cloudflare Managed Transform **Add visitor
location headers** is enabled and returns meaningful regional data. Confirm
the actual Nginx `$remote_addr` is the Cloudflare edge and not a rewritten
client address. No custom origin bypass or other unverified proxy hops.

Two templates exist:
- `ops/nginx-stage.conf`: secure baseline, **drops every incoming
  x-iradios-geo-* header** and cannot authorize paid geo.
- `ops/nginx-stage-cloudflare-geo.conf`: optional edge-verified template,
  allows only vetted Cloudflare TCP peers to inject the staging-only private
  geo auth token, country, region and city; prefecture is resolved using
  unique exact catalog mapping or fails closed to region/country.

On VPS after reviewing edge IP ingress and backing up Nginx:
```bash
cd /srv/iradios/staging/app
sudo bash ops/generate-stage-cloudflare-geo.sh
sudo cp -a /etc/nginx/sites-available/iradios-stage \
  /etc/nginx/sites-available/iradios-stage.before-geo.bak
sudo install -o root -g root -m 0644 ops/nginx-stage-cloudflare-geo.conf \
  /etc/nginx/sites-available/iradios-stage
sudo nginx -t && sudo systemctl reload nginx
```
The generated `/etc/nginx/conf.d/iradios-stage-cloudflare-geo.conf`
contains a secret: chmod 0600 and **never upload/commit/log it**. Nginx
master must be able to read it. Edge IP ranges must be refreshed whenever
Cloudflare changes them. Test forged visitor-provided `X-Iradios-Geo-Auth`,
`X-Iradios-Geo-Country`, `X-Iradios-Geo-Region` and direct-origin requests;
none may authorize charging. Client-side geolocation and staging fixture Attica
MUST NEVER create billable geo. Nginx syntax success alone is NOT proof of
the edge trust boundary; require operator-reviewed real requests.

## 5. Payment and actual internal charge acceptance
- Keep Nexi in Sandbox and confirm Gateway signed webhook HMAC, scope,
  event idempotency and `ADV-BUDGET` order-to-quote-to-campaign correlation.
- Purchase a NEW Agency v2 budget through Gateway Sandbox. Confirm only
  a `payment.paid` **signed webhook** credits a unique `nexi_verified`
  funding lot; browser redirect MUST NOT credit.
- Admin approves funded creative, campaign start/end and geo match.
- Guest/Free first play and midroll: up to three spots (maximum 46 seconds
  each); queue by daily budget, skip 15/40/55 seconds or no skip on eligible
  daily budgets strictly above EUR 45.
- Verify signed delivery ticket, actual audible foreground 10 seconds,
  audio CTA and completion independently, and >=50% visible 300ms for
  visual impression. Confirm exact nanocurrency ledger debits and immediate
  real Agency results. Replays, duplicated callbacks, multiple simultaneous
  listeners and daily cap exhaustion must not double debit or overspend.
- Releasing/skipping/expiration frees only unused reserved funds. Test
  top-up, cancellation, failed payment, refund/reversal when supported, and
  premium/addon entitlement lifecycle separately. **Do not synthesize paid
  records or overwrite historic budget.**
- Verify listener subscription and broadcaster account-wide EUR 99 Premium,
  plus station WebDSP EUR 27.90, Ad Control EUR 8.90, Audience Radar EUR 6.90
  with confirmed sandbox Gateway events and correct expiry/revocation.
- Confirm Mailpit outbox and no external messages, including Admin OTP.

## 6. Final activation / rollback
Only after verified Mongo rs0, edge-authenticated geo, v2-funded campaign,
successful real Sandbox-funded accounting UAT, and safe backup:
```bash
sudoedit /etc/iradios/staging/backend.env
# Change ONLY: ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=1
cd /srv/iradios/staging/app
sudo bash ops/check-stage-backend-env.sh /etc/iradios/staging/backend.env
sudo ./ilumadev.sh
curl -fsS https://stage.iradios.gr/api/advertising/v2/status
```
The public status must show actual `enabled:true` **only for verified
ingress geo** and Mongo readiness. Localhost status may report
`trustedGeoReady:false`, which is expected. Validate campaign analytics
and exact ledger after every paid delivery. A failing test blocks release.

Emergency stop: set `ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=0`
in private backend.env and redeploy with `sudo ./ilumadev.sh`, returning
to fail-closed nonbillable mode. Do NOT revert the data format of the Mongo
replica set in an ad-hoc rollback. Restore the backed-up original Nginx
site after geo failure, run `sudo nginx -t && sudo systemctl reload nginx`.

**Operator-only open issues:** The ChatGPT GitHub connection cannot execute
VPS SSH, create/restore the off-host backup, inspect private env files, confirm
Cloudflare edge/TLS, run Gateway Sandbox purchases or inspect real transaction
balances. Therefore no status text in this PR should claim these have passed.
