# iRadiosGR — Advertising v2 paid-delivery staging activation

**Staging only.** This guide does not activate production or change a Nexi
payment. Never treat a preview play, a synthetic location, or an Agency dashboard
balance as proof that paid delivery has settled.

## Known blockers (2026-11-15)

1. The campaign router's broad JWT prefix intercepted the guest v2 status,
   ticket, heartbeat, click and release routes. Fixed in this PR.
2. The checked-in staging Mongo Compose is **standalone** by default. The
   `mongoose.withTransaction` paid ledger needs a writable replica-set primary.
3. `ops/nginx-stage.conf` does not yet install a **signed, verified** server
   geolocation source. The ledger intentionally rejects billing without it.
4. Nexi-verified funds are compatible with event billing only when their lot
   has `rateModel=v2_event`, `settlementMode=mongo_transaction_v2`, a positive
   available nano-EUR balance and a snapshot matching the immutable v2 rate card.
   Do not reprice legacy lots or treat a 200 EUR preview budget as automatically
   spendable.
5. The financial metrics panel now distinguishes preview from paid delivery and
   reads server-side aggregates every five seconds while the tab is visible.

## Safe order of operations

1. In `/etc/iradios/staging/backend.env`, keep:
   ```env
   APP_ENV=staging
   ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=0
   ADVERTISING_V2_DELIVERY_SECRET=<existing private random 32+ byte secret>
   ```
   Never commit these values, use a `VITE_*` variable, share them in chat, or
   print them in a support log. Both `backend.env` and `compose.env` must
   remain root-owned mode 0600.
2. Deploy the PR into the staging checkout **before** enabling replica-set mode:
   ```bash
   cd /srv/iradios/staging/app && sudo ./ilumadev.sh
   ```
3. Make a **verified off-host backup** of the current **staging-only**
   `iradios_stage` database, including its collections and authentication
   users. Record the recovery procedure and a rollback window. The migration
   script intentionally refuses to run without the operator's explicit
   acknowledgement. It never deletes a volume or performs `dropDatabase`.
4. Set exactly once in `/etc/iradios/staging/compose.env`:
   ```env
   STAGE_MONGO_RS_ENABLED=1
   ```
   Ensure paid delivery is still OFF. Then run:
   ```bash
   cd /srv/iradios/staging/app
   sudo env IRADIOS_STAGE_RS_MIGRATION_APPROVAL=I_VERIFIED_STAGING_BACKUP bash ops/enable-stage-mongo-replicaset.sh
   ```
   The script creates a **private** authenticated Mongo keyfile (if absent),
   reconfigures only the existing staging Mongo container, initializes the
   single-node `rs0` once, and verifies a writable primary. **Do not run
   until you can restore the staging database.** If a step fails, leave financial
   delivery OFF and review Mongo logs/backup before proceeding.
5. Apply the replica-set backend URI and verify health:
   ```bash
   cd /srv/iradios/staging/app && sudo ./ilumadev.sh
   curl -fsS http://127.0.0.1:5511/api/advertising/v2/status
   ```
   At this point it should report `configured:false` and
   `mongoReplicaSetReady:true`. A missing primary must show a false readiness.
6. Configure **trusted visitor geo at the public reverse proxy** as a separate,
   operator-reviewed infrastructure step. The service requires
   `IRADIOS_TRUSTED_GEO_SECRET` in private `backend.env` plus the exact same
   32+ byte value injected by trusted Nginx under the
   `x-iradios-geo-auth` header. All four `x-iradios-geo-*` headers must be
   **overwritten**, not forwarded from the visitor. Country, region and
   prefecture must originate from a validated IP-to-location resolver or
   equivalent **trusted** Cloudflare ingress restricted to verified Cloudflare
   IP ranges. The standard `ops/nginx-stage.conf` is NOT sufficient as-is.
   Do not hardcode `Attica` or infer paid geo from browser locale, arbitrary
   query parameters, `x-forwarded-for` or unverified `CF-*` headers. A
   country-only trusted answer cannot authorize regional/prefecture inventory.
   Verify that forged browser headers and direct-origin requests cannot assert
   billable geo before enabling the switch.
7. In the Agency audited metrics, verify **compatible v2 Nexi funding** for
   each specific campaign. The dashboard may display a historical 200 EUR lot
   as prepaid while still showing `compatibleFunding:false`. Reconcile
   mismatches against signed Nexi events/quotes; **no automatic backfill or
   migration of historical money is authorized by this change**.
8. Perform operator-supervised first-play and mid-roll tests with a properly
   funded v2 staging campaign, Guest and Free listener, mobile and desktop:
   verify an issued ticket, signed media URL, ~10 seconds of uninterrupted
   audible foreground playback, unique `listen10`, CTA if clicked, completion,
   release/skip, funds held then settled, and daily budget. Repeated heartbeat,
   replay and concurrent users must not double-charge. Dashboard should update
   within approximately five seconds after the server records a debit.
9. Only once Mongo, geo, compatible funding and test transactions all pass,
   switch **just** `ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=1` in private
   `backend.env`, then deploy/restart the staging backend with the usual
   `sudo ./ilumadev.sh`. The public GET status must report `enabled:true`
   for a request arriving through the *verified* geo ingress, while a direct
   localhost request can intentionally report `trustedGeoReady:false`.
   All paid inventory MUST fail closed if any prerequisite disappears.

## Emergency off switch

Set `ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=0` in private
`/etc/iradios/staging/backend.env` and redeploy/restart the staging backend.
That restores the explicitly non-billable QA preview under the existing
staging Compose preview policy. Keep the Mongo replica-set configuration once
migrated; reverting its data format is **not** the emergency billing switch.

## Security and operator boundaries

- No bulk refunds, top-ups, hidden wallet writes, fake Nexi receipts or
  production migration are part of this PR.
- Root-owned files under `/etc/iradios/staging/` remain off Git.
- No unauthenticated campaign/finance queries: analytics use the owner/admin
  JWT; public tickets use independently verified identity/geo and capability.
- The Mongo migration needs backup, an SSH operator and a controlled maintenance
  window. This GitHub PR alone **does not** migrate the live staging VPS.
