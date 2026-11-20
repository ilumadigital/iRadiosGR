# Staging Billing Repair — iRadios VI

## Scope and safety
This implementation affects **only iRadios staging** in the `staging` branch.
It scans three local checkout ledgers:
- Listener: `BillingOrder` (`L-PREM`, `L-WINBACK-199`)
- Broadcaster: `BroadcasterBillingOrder` (Premium, Add-ons, one-off Boosts)
- Advertising: `AdvertisingPaymentIntent` (prepaid budget)

Environment checks are mandatory before Mongo access: `APP_ENV=staging`,
`IRADIOS_GATEWAY_ENV=staging`, a configured staging Gateway credential.
No production database, secret, provider write, cancellation, refund, MIT,
automatic re-charge or paid entitlement is modified by this repair.

A signed Gateway status is read-only. The repair only releases a local checkout
lock when one of these proofs exists:
1. Local record already terminal (with no conflicting financial evidence).
2. Gateway explicitly returns `failed` or `canceled`, with matching payment/order refs.
3. An original request-key lookup returns signed 404 after at least 3 minutes
   and the local record has **never** recorded a payment ID or order ID.

All changes use conditional MongoDB updates that cannot overwrite a
concurrently updated webhook record. Advertising payment repair first verifies
no funding lot exists for the quote/payment. When a failed advertising intent is
repaired, its outstanding quote is invalidated, never re-funded. Repair retains
the original orders as audit records; it does not delete history.

**Never auto-unlock** a `paid`, provider-`unknown`, pending or redirect
payment, a network timeout/503, a row with paid evidence/events, or a Gateway
404 where the iRadios row still contains a Gateway/Nexi order ID. Those states
require signed webhook/Gateway/Nexi reconciliation; manually relabeling them
failed may cause a double charge.

## Offline checks
```bash
cd backend
node --test tests/stagingBillingRepair.test.cjs
node --test tests/stagingBroadcasterOrphanRecovery.test.cjs tests/broadcasterCheckoutRecovery.test.js
```

## Stage deployment
After code review and staging merge, deploy **iRadios only** (NOT Gateway):
```bash
cd /srv/iradios/staging/app && sudo ./ilumadev.sh
```
Alternatively use the configured `iluma dev` command, if installed.
Do **not** run `/srv/iluma-gateway/app/iluma-g-dev.sh`: it rebuilds a
shared production/staging runtime and requires distinct explicit approval.

## Operator dry-run and bounded repair
The CLI emits one JSON line per scanned intent plus a final JSON summary.
It prints only local order ID, billing family, SKU and reason, not customer keys
or Nexi secrets. It is DRY-RUN by default. For a manual pass:
```bash
sudo docker exec -i iradios_stage-backend-1 node scripts/billingRepairStaging.js --limit 500
```
Inspect each `READY`, `REVIEW` and `DEFERRED` outcome first.
To repair only eligible staging cases:
```bash
sudo docker exec -i iradios_stage-backend-1 node scripts/billingRepairStaging.js --limit 500 --apply
```
Rerun until the summary has no `READY` cases; records that require provider
review intentionally remain locked. An order with a stored provider ID that
returns Gateway 404 (including the earlier single Premium orphan) still needs
independent Nexi Sandbox evidence and the separate, existing operator-only
`recoverStagingBroadcasterOrphan.js` workflow.

## Automatic repair
The staging-only scheduler runs every 3 minutes, checks up to 25 candidate
records per ledger per pass, and rotates its cursor so old ambiguous records
cannot starve newer ones. Only the three verified safe cases above are applied.
Production starts no such job. The existing Broadcaster read-only checkout
recovery is unchanged.

## UAT before any production proposal
- Confirm staging Gateway keys route to staging tenant/MySQL and Nexi Sandbox.
- Inspect a new redirect, successful paid webhook, cancelled checkout, failed
  checkout, a simulated signed 404 without refs, and a signed 404 WITH refs.
- Confirm one new checkout is possible after the confirmed terminal repair.
- Confirm a paid/webhook-in-flight/unknown payment is never retried or credited.
- Inspect Advertising quotes and funded lots for duplicate credits.
- Verify the scheduler never appears on production, and no Gateway restart,
  credential change or production billing toggle was performed.

This release does NOT claim to resolve every orphan automatically. A stored
provider order ID and missing Gateway ledger is a financial investigation,
not evidence of zero charge.
