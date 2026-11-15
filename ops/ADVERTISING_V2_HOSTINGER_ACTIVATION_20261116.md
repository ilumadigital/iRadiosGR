# iRadiosGR — Hostinger production-like Advertising v2 staging

**Status:** Code change only until manually deployed by SSH. This is NOT a switch to live Nexi merchant processing. ILUMA Gateway remains **Sandbox** and generic staging mail remains **Mailpit**. Existing Admin OTP SMTP configuration is preserved by this change.

## Confirmed by operator before this change (2026-11-15/16)

- MongoDB authenticated `rs0` reported `mongoReplicaSetReady:true` / `mongoReason:ok`.
- Hostinger Nginx + MaxMind GeoIP2 installed via `ops/install-stage-geoip2-trust.sh`; external browser returned `trustedGeoReady:true`, precision `prefecture`.
- A VPS-generated forged-header *status* probe matched the untrusted baseline. This is only a partial anti-spoof test, NOT proof for every public-IP path. Test trusted requests with injected headers separately.
- Financial gate returned HTTP 503 while disabled.
- All three previously archived Agency campaigns were hard-deleted in staging by the operator (3 campaign docs, 2 audio and 2 banner creatives); their 3 Gateway-verified funding lots were preserved as historical financial records. Do not reuse those lots for new campaigns.
- Private `backend.env` and `compose.env` were recovered, validated, and restored; do not regenerate any secrets.

## Source-level controls in this change

1. Compose hard-disables `AD_STAGE_QA_APPROVAL_ENABLED`, `AD_STAGE_PAID_PLACEMENT_PREVIEW` and `AD_DELIVERY_BILLING_ENABLED`. There is no free/unticketed paid Agency inventory by default.
2. V2 financial delivery requires staging, explicit opt-in, signed Gateway Sandbox funding mode, 32+-byte delivery secret, and NO QA, preview, or legacy delivery billing switches.
3. The deploy preflight correctly **requires** the `compose.stage.replicaset.yml` override when financial v2 is enabled (an earlier inverted condition incorrectly rejected enabled rs0).
4. The private backend ENV preflight rejects duplicate or invalid financial flags, missing secrets, live Gateway credentials, legacy billing overlaps, or Sandbox disabled.
5. Agency results show spendable v2-event credit separately from historical balances; only running, approved, funded campaigns with daily room show as payable.
6. Gateway outbox replays for old physically deleted campaigns ACK an **exact existing paid receipt** without recreating campaigns, funds or financial events; unknown/mismatching callbacks remain blocked.

## First deploy: close QA preview with financial gate OFF

Verify `/etc/iradios/staging/backend.env` is nonempty, root-owned mode 0600 and contains:

```dotenv
APP_ENV=staging
IRADIOS_BILLING_SANDBOX_ENABLED=1
ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=0
# ADVERTISING_V2_DELIVERY_SECRET and IRADIOS_TRUSTED_GEO_SECRET
# remain PRIVATE and unchanged; never paste them into logs or Git.
```

In `/etc/iradios/staging/compose.env`, preserve both existing MongoDB passwords and `STAGE_MONGO_RS_ENABLED=1`.

Run:

```bash
cd /srv/iradios/staging/app
sudo bash ops/check-stage-backend-env.sh /etc/iradios/staging/backend.env
sudo ./ilumadev.sh
docker exec iradios_stage-backend-1 node -e "for(const k of ['AD_STAGE_QA_APPROVAL_ENABLED','AD_STAGE_PAID_PLACEMENT_PREVIEW','AD_DELIVERY_BILLING_ENABLED','ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED']) console.log(k,process.env[k]||'UNSET')"
curl -fsS https://stage.iradios.gr/api/advertising/v2/status
```

Expected at this stage: three legacy/QA switches `0`, financial switch `0`, `configured:false`, Mongo ready; trusted geo may be false on the VPS's own IP.

## Financial activation (operator-only, no new production keys)

Before enabling, confirm the off-host Mongo backup is restorable, signed GeoIP2 ingress is still installed, and public spoofed headers cannot override actual provider-derived location. Never use synthetic trusted IP/geo fixtures for chargeable UAT.

Edit **only the private** `/etc/iradios/staging/backend.env`:

```dotenv
IRADIOS_BILLING_SANDBOX_ENABLED=1
ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=1
AD_STAGE_QA_APPROVAL_ENABLED=0
AD_STAGE_PAID_PLACEMENT_PREVIEW=0
AD_DELIVERY_BILLING_ENABLED=0
AD_PAYMENTS_SANDBOX_ENABLED=0
```

Leave the signed Sandbox Gateway credentials, existing `ADVERTISING_V2_DELIVERY_SECRET` and `IRADIOS_TRUSTED_GEO_SECRET` unchanged; keep production Gateway credentials absent. Any of the last four legacy flags may be omitted instead of set to `0`. Do NOT copy the example over your full ENV. The code disallows activation if these switches conflict.

```bash
cd /srv/iradios/staging/app
sudo bash ops/check-stage-backend-env.sh /etc/iradios/staging/backend.env
sudo ./ilumadev.sh
curl -fsS https://stage.iradios.gr/api/advertising/v2/status
```

Expect `configured:true`, `mongoReplicaSetReady:true`, and `enabled:true` ONLY for requests with independently verified trusted geo. Public `enabled:false` can remain correct for untrusted IPs.

## End-to-end financial UAT — **not covered by static CI**

1. Agency creates a fresh `workflowVersion:2` campaign (valid dates, valid daily budget, geo matching a real visitor), with a creative 10–46 seconds for audio or valid visual placements.
2. Agency completes **real Gateway Sandbox checkout** for `ADV-BUDGET`. Confirm an authentic signed `payment.paid` callback, unique intent/quote, and `nexi_verified` funding lot with `rateModel:v2_event`, `settlementMode:mongo_transaction_v2`, positive available nano-EUR and exact rate-card snapshot. Browser redirect or a manually inserted Mongo document must not fund delivery.
3. Admin uses the normal approval flow for campaign/creative; check eligible inventory for Guest and Free, not Premium.
4. From public trusted-geo clients verify a signed ticket, atomic reservation, real foreground/audible 10-second listen, CTA and completion charged independently; visual viewability >=50% continuously >=300ms; skip/release refunds only unused reservation.
5. Confirm campaign-level daily cap, compatible wallet balance, v2 event counts, zero duplicate debits on replay/heartbeat and no debit on failed/skipped play. Test expiry, concurrency and Guest/Free/Premium behavior.
6. Check Gateway remains Sandbox, Mailpit is still working, and no production merchant credentials or checkout destinations are used.

## Emergency rollback

In private `backend.env`, set `ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=0`; then run `sudo ./ilumadev.sh`. **Paid ticket creation stops, with QA preview still OFF** (do not re-enable free unticketed previews). Do not alter Mongo replica-set configuration, delete its volume, or modify historical Gateway receipts.

Git pushes DO NOT deploy: staging always needs manual `sudo ./ilumadev.sh`. The `gateway.iluma.gr` repository is NOT changed in this rollout.
