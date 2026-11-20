# Broadcaster checkout tenant isolation — STAGING DEVELOPMENT ONLY

## Verified trigger
The operator's **iRadios production MongoDB** contained 17
`broadcasterbillingorders` records: 1 production/canceled, 10
staging/canceled, 4 staging/paid, 2 staging/unknown. The 2 unknown staging
records have provider references and active locks. The production repair
audit returned `inspected:0` because it correctly considers only records
with `environment:production`.

The staging checkout source previously read `findOne({lockKey})` without
an environment filter. Its unique MongoDB lockKey index is GLOBAL: the
unscoped historical lock `account:sku:resource` may conflict with a new
production checkout in the same imported database even though it belongs
to the staging tenant. The short-lived checkout lease was also keyed by
account ObjectId only.

## Fix
- New **Broadcaster** checkout locks: `staging:account:sku:resource` or
  `production:account:sku:resource`. These are **local iRadios Mongo**
  lock identities only: Gateway's signed requestKey, HPP, SKU, merchant
  tenant routing and Nexi connections are unchanged.
- Find existing locks by `environment`, `accountId`, `sku` and
  both new scoped and old legacy lock forms. Legacy locks **still
  protect any pending/unknown payments in their owning environment**.
- Idempotency and duplicate-key exception reads are scoped to the
  owning environment/account so imported staging orders are NEVER
  returned from production checkout.
- A canceled/failed lock is released only if no paid evidence, periods
  or signed events exist, with a conditional, environment-bound update.
  Pending, redirect, unknown and paid locks remain in place until safe
  payment reconciliation.
- Monthly checkout leases use a string `environment:account` _id.
  Historical ObjectId leases are **NOT touched** and expire naturally
  via the existing 5-minute TTL index.
- Retain existing GLOBAL unique `lockKey` index. Different prefixed
  strings can coexist across environments; within the same environment
  the index still ensures that new concurrent checkouts for the same
  scope cannot both acquire that lock. No index drop or migration.
- Do not rewrite the `environment` field on imported rows (it is
  immutable for a reason). Do not delete rows or reference tokens.
- Listener Premium and Winback had the same problem: globally unique
  unscoped `account:L-PREM` locks, unscoped idempotency and renewal
  checks, plus an unscoped per-user order/history endpoint. New listener
  lock values are `environment:account:L-PREM`, both subscription and
  winback share one per-tenant lock, and all affected reads/CAS writes
  check the owning environment and account. Old production listener
  locks remain blockers; imported staging listener locks cannot block
  live checkout. The original global unique index remains unchanged.
- The Production Billing Repair scheduler still scans ONLY
  `environment:production`, and its flags remain off unless separately
  approved. It never cleans the imported staging financial history.

## Read-only audit
An aggregate inventory script is included, with Mongo native read-only
operations and no Gateway calls or writes:

```bash
node backend/scripts/auditBroadcasterLockIsolation.js
```

Run only from a correctly configured iRadios backend container, after
independent approval for access to the respective environment's data.
It prints totals, environment/status/lock-format group counts, cross-
environment logical-key conflicts and duplicate production logical locks;
no order IDs, account IDs or payment references are emitted.

## Rollout safety
1. Staging PR tests and CI (no production writes or shared Gateway deploy).
2. After approval, merge the staging PR and perform a **manual staging
   deployment** using the actual VPS scripts, then test canceled/failed
   retry and unknown-provider lock preservation against Nexi Sandbox.
   Also verify Listener Premium/Winback history and retry are limited
   to their own environment.
3. Seek **separate approval** for a selective PR to iRadios `main`
   (do not bulk merge all staging features).
4. Before an approved production rollout, back up production data, verify
   existing live-checkout activity has quiesced, run the read-only lock
   inventory, and revalidate the production Gateway tenant + Nexi Live
   prerequisites. Check whether the live recurring terminal is ready.
5. For a future approved production deployment:
   `cd /srv/iradios/production/app && sudo bash ops/deploy-prod.sh`.
   Only once approved should live repair flags be activated; there is
   no need to deploy the shared Gateway or change Gateway global APP_ENV.
6. Verify new production checkout no longer sees imported staging
   `unknown` locks. Real `unknown` production payments with stored
   provider IDs MUST remain locked for signed-provider reconciliation.
7. If any billing preflight (live MIT recurring state, missing webhook,
   provider timeout) is unavailable, fail closed. Tenant lock isolation
   alone does NOT mean Nexi Live recurring/MIT is activated.

## Operational limitation
The imported staging history remains in `iradios_prod` until a
**separately approved**, audited migration/archival process. Keeping
tenant boundaries is required even while these historical rows exist.
A manual command that changes their statuses or deletes their locks
is NOT part of this PR.
