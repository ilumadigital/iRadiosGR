# Production Billing Repair — selective main PR, NOT deployed

## Hard boundaries
- This is a **selective main-targeted PR** based on the staging-tested logic. Merge and deploy are separate approvals.
- This PR alone does not deploy or mutate `play.iradios.gr`, the Gateway VPS, Nexi Live,
  production MongoDB or any production secrets or payments.
- iRadios staging -> staging Gateway tenant/DB/keys -> Nexi Sandbox.
- iRadios production -> production Gateway tenant/DB/keys -> Nexi Live.
- Gateway global `APP_ENV=production` is **not a tenant selector**. NEVER change
  Gateway global ENV to make an iRadios tenant work.
- The Gateway has ONE shared runtime under `/srv/iluma-gateway/app` rebuilt
  from its Git `main`; `iluma-g-dev.sh` affects BOTH tenants and is NOT
  authorized or required for this feature.

## What is prepared
- A self-contained, selectively ported repair engine preserves explicit staging/production boundaries; no mass staging merge is required.
- A **local-only** production inventory works BEFORE billing/cutover activation.
  It requires operator confirmation but needs no Gateway credentials or Nexi
  calls. It only issues Mongo collection FIND reads; no indexes or writes.
- A separate signed-Gateway read-only reconciliation audit requires the matching
  production Gateway key/secret, active production billing/cutover approval and
  the explicitly correct iRadios production MongoDB connection.
- A production-scoped `--apply` is impossible unless BOTH:
  `IRADIOS_PRODUCTION_CUTOVER_APPROVED=1` **and**
  `IRADIOS_PRODUCTION_BILLING_REPAIR_ENABLED=1` are set, and a human adds
  `--apply --confirm-live` to the command.
- An **automatic** production scheduler requires a SECOND independent opt-in:
  `IRADIOS_PRODUCTION_BILLING_REPAIR_AUTO_ENABLED=1`.
  All repair flags are **off when unset**.
- All scoped scans are bounded, use only signed existing-payment Gateway GETs,
  never replay checkout POSTs, never issue Nexi writes, and never grant paid
  entitlements or advertising funding.
- The repair never frees a paid checkout with leftover lock, contradictory signed events, pending, redirect, unknown provider, timeout,
  signed-event/paid-evidence or Gateway-404-with-stored-provider-reference
  payment. Those are flagged for independent provider review.
- A verified terminal `failed` or `canceled` may release the *local*
  checkout lock, conditionally. Original payment/order history is retained.
- Production AdvertisingPaymentIntent lacks an immutable environment marker.
  Production advertising repair is **unconditionally REVIEW-only** until a
  separate audited code change adds verifiable tenant provenance and is approved.
  It cannot mutate any advertising intent, quote or funding lot even if the
  production write flags are enabled. Staging Advertising repair is unchanged.

## Production promotion requires separate approval
1. Staging Cancel -> new checkout has passed user UAT. Main PR must pass its
   independent production repair safety CI, and be explicitly approved before merge.
2. Stage UAT: repeated Cancel -> fresh checkout; delayed/duplicated webhooks;
   unknown and signed 404 WITH stored order ref must remain locked; paused
   Gateway; funded Advertising quote.
3. Audit stage historical `INVALID_SCOPE_OR_REFERENCES` cases. Do not
   change old records or relax the validator to force a pass.
4. This change IS a selective production PR from `main`: do not merge
   unrelated `staging` commits by default. Review only its scoped diff and
   verify production Checkout & Gateway client compatibility.
5. Obtain explicit approval for production PR merge, manual `iluma pro`
   deployment, access to production data and enabling automated *live* repair.
   The target outcome is **hands-free automatic repair** after production
   activation, NOT a recurring manual operator script. Never infer financial
   activation consent merely from `/startdev`.
6. Confirm externally that the iRadios production Gateway tenant has **only**
   Nexi Live keys, and its signed requests target the expected production tenant
   and DB. Confirm iRadios production MongoDB URI points to production data.
   Do not print credentials, Mongo URIs or user/payment tokens.
7. After an approved deployment and separate approval to access production
   MongoDB, the FIRST run is a LOCAL-ONLY read-only inventory. It works even
   with `IRADIOS_BILLING_ENABLED=0` and cutover still disabled:
   ```bash
   sudo docker exec -i iradios_prod-backend-1 node scripts/billingInventoryProduction.js --limit 500 --confirm-readonly-audit
   ```
   Container name must first be verified on the host. This script does not
   import the Gateway client, contact Nexi, create Mongo indexes or mutate DB.
   It lists only local candidate/review states, not proof of provider charge.
8. Once the *separately approved* production Gateway tenant and billing are
   active, the signed read-only reconciliation audit may run:
   ```bash
   sudo docker exec -i iradios_prod-backend-1 node scripts/billingRepairProduction.js --limit 500
   ```
   Inspect every REVIEW, DEFERRED and READY finding with the financial
   operator. This audit never releases locks.
9. For the intended FULLY AUTOMATIC live behavior, once separately approved
   and signed production reconciliation has been checked, enable BOTH
   `IRADIOS_PRODUCTION_BILLING_REPAIR_ENABLED=1` and
   `IRADIOS_PRODUCTION_BILLING_REPAIR_AUTO_ENABLED=1` in the iRadios
   production backend env, and redeploy explicitly with `iluma pro`.
   Thereafter the 3-minute scheduler operates without repeated operator
   scripts. Confirm terminal events and signed status reconcile on the
   correct production tenant. For a phased rollout, first enable the write
   flag while leaving AUTO=0, then enable AUTO=1.
10. If manual repair is exceptionally required, turn on ONLY
   `IRADIOS_PRODUCTION_BILLING_REPAIR_ENABLED=1`, retain
   `IRADIOS_PRODUCTION_BILLING_REPAIR_AUTO_ENABLED=0`, deploy new env manually,
   and perform a SECOND audited dry-run. A *separately* approved operator may
   then run `--apply --confirm-live` on a bounded batch.
11. To stop new automatic passes, set `IRADIOS_PRODUCTION_BILLING_REPAIR_AUTO_ENABLED=0` and manually
   redeploy. To block manual live repair writes, also set
   `IRADIOS_PRODUCTION_BILLING_REPAIR_ENABLED=0` and redeploy.

## Release / rollback limitations
- Switching flags OFF stops new repair passes; it does not revert already
  failed/canceled terminal states. Do not re-lock or delete repair history.
- Continue to process signed paid webhooks and reconcile each result.
- Production recurring MIT capability remains a separate Nexi Live terminal
  readiness requirement, not something repaired by this job.
- Changes in Git require manual server deployment. Git push alone is not a
  staging or production deploy.
