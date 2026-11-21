# iRadios VI — staging-first Gateway repair and release plan (2026-11-21)

## Ground truth before this change
- iRadios production checkout is `/srv/iradios/production/app` (main), staging is `/srv/iradios/staging/app` (staging).
- Gateway has **one** shared VPS PHP/web runtime `/srv/iluma-gateway/app`, deployed from Gateway **main**. `APP_ENV=production` is global, **not** a tenant selector.
- Immutable HMAC credentials select staging/production tenant, MySQL database and Nexi Sandbox/Live independently.
- Audit before patch: staging 1 pending webhook (HTTP 401, 23 attempts); production 3 pending (HTTP 401, all `iradios_stage_routed=1`). Production has 1 recorded `paid` EUR 3.99. Do not erase or blindly re-route history.
- Gateway active PHP image did **not** contain `bin/iradios-return-doctor.php` even though Gateway Git main did. A new source-image guard blocks this regression.

## Required sequencing / approval boundary
1. Review iRadios staging PR and Gateway PR; wait for green offline CI.
2. After approval **for the shared Gateway rebuild**: merge the reviewed Gateway PR to Gateway main, then manually rebuild using the approved VPS-local `sudo ./iluma-g-dev.sh`. This affects **both** tenants; it is **not** a staging-only deployment.
3. iRadios staging: merge reviewed staging branch, then `cd /srv/iradios/staging/app && sudo ./ilumadev.sh`; it rebuilds only the iRadios stage containers. The new stage guard compares critical billing JavaScript files in the running backend image against Git HEAD.
4. Perform staging Gateway HMAC-alignment inspection, Sandbox checkout, callback `payment.paid`, idempotent replay, new checkout after rejected HPP, explicit Listener/Broadcaster recurring consent, and separate Ads quote tests. The PHP worker must not be started with real production MIT enabled.
5. **Only after explicit production approval**: promote reviewed iRadios staging changes to main and `cd /srv/iradios/production/app && sudo ./ilumaprod.sh`. The production backend image guard runs there too.
6. Keep Gateway production MIT `--no-charge` until separate provider MIT UAT and financial approval. No DB migration or live charge is performed by these PRs.

## ENV — do not expose secrets in logs
### Gateway private `/etc/iluma-gateway/iluma-gateway.env`
Keep `APP_ENV=production`, `PRODUCTION_ENABLED=1`, the 3 separate MySQL DSN/user/password groups, `MASTER_KEY_B64`, Nexi bases, HMAC registry, and isolated `IRADIOS_STAGING_WEBHOOK`/`IRADIOS_PRODUCTION_WEBHOOK`.
- Keep `IRADIOS_PRODUCTION_PLAY_ENABLED` at the previously approved direct-play value; do **not** switch routing during troubleshooting.
- Keep `IRADIOS_STAGE_PRODUCTION_ENABLED` and `IRADIOS_STAGE_PRODUCTION_WEBHOOK` **until the 3 historical stage-routed live events are reconciled**. Then remove via a separately reviewed follow-up commit that removes code references first.
- Keep `IRADIOS_PRODUCTION_REJECTED_HPP_REPAIR_ENABLED` and `IRADIOS_PRODUCTION_REJECTED_HPP_AUTO_ENABLED` until provider-evidence HPP repair is replaced and tested.
- `ADVERTISING_SANDBOX_ENABLED` can be considered for removal if present after reviewing the loader/consumers; it does not activate Sandbox Ads independently.
- Default-off, separate UAT gates: `MIT_SANDBOX_EXECUTION_ENABLED=0`, `MIT_SANDBOX_UAT_APPROVED=0`, `BROADCASTER_MIT_SANDBOX_EXECUTION_ENABLED=0`, `BROADCASTER_MIT_SANDBOX_UAT_APPROVED=0`. Enable in pairs **only** after provider Sandbox UAT.
- Production MIT default-off: `IRADIOS_PLAY_MIT_EXECUTION_APPROVED=0`, `MIT_PRODUCTION_EXECUTION_ENABLED=0`, `MIT_PRODUCTION_UAT_APPROVED=0`, `BROADCASTER_MIT_PRODUCTION_EXECUTION_ENABLED=0`, `BROADCASTER_MIT_PRODUCTION_UAT_APPROVED=0`. Do **not** set any to 1 without explicit production billing consent.
- Separately, the root-controlled `/etc/iluma-gateway/production-worker.enabled` needs the **exact** line `ENABLE_PRODUCTION_MIT=1` for charging-mode worker; leave absent during this stage-first release. Both the marker and per-feature PHP flags are required to charge.

### iRadios staging backend `/etc/iradios/staging/backend.env`
- `APP_ENV=staging`, `IRADIOS_GATEWAY_ENV=staging`. Use **only** `ILUMA_GATEWAY_STAGING_KEY` and `ILUMA_GATEWAY_STAGING_SECRET`.
- Explicitly exclude the production key/secret even as commented examples where possible. If Sandbox checkout enabled, keep `IRADIOS_BILLING_ENABLED=1` (legacy `IRADIOS_BILLING_SANDBOX_ENABLED=1` is still recognized; choose a consistent reviewed configuration).
- Match the effective webhook receiver secret with the staging Gateway outbox signer; **do not** copy production keys into staging to fix an HTTP 401.
- Keep `STAGE_ENABLE_SONOVAULT=0` until that integration is approved. Paid Advertising v2 requires a staging Mongo replica set; the existing deployment guard enforces it.

### iRadios production backend `/etc/iradios/production/backend.env`
- `APP_ENV=production`, `IRADIOS_GATEWAY_ENV=production`. Use **only** `ILUMA_GATEWAY_PROD_KEY` and `ILUMA_GATEWAY_PROD_SECRET`.
- `IRADIOS_BILLING_ENABLED` and `IRADIOS_PRODUCTION_CUTOVER_APPROVED` must **not** be set to 1 merely to make env preflight green: the existing preflight allows disabled billing, and only verified production UAT may approve 1.
- Paid Advertising requires its **separate** `ADVERTISING_V2_PRODUCTION_APPROVED=1` approval and correct financial-delivery secrets.
- Review/rotate any credentials previously pasted in chat **with a webhook-key retention plan**; changing signing credentials while pending events exist can cause more 401s.
- Keep production and staging `JWT_SECRET` distinct when rotating sessions; coordinate user logouts and token expiry.

## Read-only diagnostics (run after reviewed containers rebuilt)
```bash
# Compare these outputs: exact same 24-hex proof means same signing secret.
sudo docker exec iluma_gateway-php-1 php bin/check-webhook-signing.php staging
sudo docker exec iradios_stage-backend-1 node scripts/checkGatewayWebhookKey.cjs

# Source parity. These scripts STOP on missing/stale runtime artifacts.
cd /srv/iluma-gateway/app
sudo bash deploy/vps/check-source-match.sh
sudo bash deploy/vps/check-readiness.sh
cd /srv/iradios/staging/app
sudo bash ops/check-backend-source-image.sh staging
cd /srv/iradios/production/app
sudo bash ops/check-backend-source-image.sh production

# Financial events grouped by event type, verified ledger status and route.
sudo docker exec iluma_gateway-php-1 php bin/audit-pending-outbox.php
sudo docker exec iluma_gateway-php-1 php bin/vps-ledger-audit.php
```

If the Sandbox HMAC proofs differ, fix **only** the staging credential mapping/rotation using the approved administration workflow. If they match but HTTP 401 persists, audit the actual backend raw-body/HMAC middleware path and clock skew before changing any key.

The three historical production events are deliberately **not** auto-forwarded to play. First inspect event types, provider capture/refund evidence and paid rights correlation; then apply an explicitly approved reconciliation plan. Do not turn on `IRADIOS_LEGACY_STAGE_TO_PLAY_ENABLED=1` as an unverified shortcut.

## The three deploy commands (execute only at their approval stages)
```bash
# Shared Gateway — only after separate common-runtime approval:
cd /srv/iluma-gateway/app && sudo ./iluma-g-dev.sh

# iRadios staging — after staging merge and env validation:
cd /srv/iradios/staging/app && sudo ./ilumadev.sh

# iRadios production — only after production release approval:
cd /srv/iradios/production/app && sudo ./ilumaprod.sh
```

**Not a release sign-off:** Offline checks do not prove that new Nexi payment, real signed webhooks, MIT renewal, audio DSP, advertising spend or production subscriptions function. These need staging UAT and separately authorized live verification. No script makes an ambiguous Nexi `unknown` payment safe to cancel without provider evidence.
