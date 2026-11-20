# iRadios production cutover — staged, no live changes by Git push

## Contracts
- Production checkout: `main` in `/srv/iradios/production/app`; Docker project `iradios_prod`; localhost frontend 5610/backend 5611.
- Staging checkout: `staging` in `/srv/iradios/staging/app`; Docker project `iradios_stage`; localhost 5510/5511.
- Production MongoDB and uploads reside only in `/srv/iradios/production`, distinct credentials, networks and volumes.
- Production stack does **not** include Mailpit. Staging Mailpit and its containers stay running throughout cutover.
- No Git push auto-deploys. `sudo bash ./ilumaprod.sh` is manual and refuses an unverified production dataset.

## Mandatory steps BEFORE any play.iradios.gr DNS change
1. Audit and back up the **old** live play.iradios.gr database/uploads and document the destination IP. Do not overwrite historical users without a conflict resolution report.
2. Create separate production folders, owner and secrets outside Git. Prepare `/etc/iradios/production/compose.env` with independent PROD_MONGO_PASSWORD and PROD_MONGO_APP_PASSWORD; prepare `backend.env` from backend/.env.production.example using real SMTP, production Turnstile siteverify credentials and production-only Gateway credentials. Keep billing flags zero.
3. Check VPS free RAM first; do not start a second MongoDB if memory headroom is insufficient. On production checkout, create independent secrets and an authenticated rs0 with `sudo bash ops/init-prod-mongo-secrets.sh`, then `sudo bash ops/start-prod-mongo.sh`. Provision the restricted user with `sudo bash ops/prepare-prod-mongo-user.sh`. These commands act only on iradios_prod (except reading the Mongo UID/GID from the stage image). Do not connect to staging volumes.
4. Take a verified full backup of staging MongoDB plus every directory under `/srv/iradios/staging/uploads`, preserving Mongo ObjectIds and relationships. Validate backup archive and restore in a **separate production namespace**, e.g. `--nsFrom 'iradios_stage.*' --nsTo 'iradios_prod.*'` (do not use destructive `--drop` on any active DB). This is only an initial candidate copy.
5. Review and classify payment rows by **actual Gateway tenant/provider payment evidence**, not by `environment` label alone. Some staging rows are real production Nexi charges (the legacy production-to-stage routing), while others are sandbox. The migration must preserve provider order/contract/payment identity; synthetic sandbox rows cannot confer production entitlements.
6. Before final cutover `IRADIOS_PRODUCTION_CUTOVER_APPROVED=0` forces the backend to reject ALL mutating HTTP requests and suppress startup jobs, user password auto-migration, email and cleanup; do not enable before the final consistent snapshot. Audit all side-effecting services (including read paths) as part of UAT. Billing stays disabled separately. Reconcile the email outbox and payment nonce/event records before enabling delivery. Never replay welcome emails or Nexi checkouts.
7. Run read-only `sudo bash ops/verify-prod-data-copy.sh` to compare ALL collection row counts and SHA256 of uploaded files. It must report zero differences; also review sample ObjectIds, station ownership, admins, broadcasters, producers, campaigns, budgets, paid entitlements and file references. Produce a signed operator checklist and only then create the local root-owned marker `/etc/iradios/production/data-verified` after explicit review.
8. Run `sudo bash ./ilumaprod.sh` on production checkout. Verify `127.0.0.1:5610`, `127.0.0.1:5611/api/health`, auth, streams, dashboards, asset paths, admin access and CSP/CORS.
9. Modify ILUMA Gateway **separately** so NEW production payments go to `https://play.iradios.gr/api/gateway/webhook`, and Nexi checkout returns to play. Safely migrate previous stage-routed production webhook deliveries, credentials and entitlements before stopping legacy path. Production MIT charging must remain disabled unless separately approved.
10. At the agreed cutover: freeze staging writes/background jobs, take the **final** consistent staging snapshot and uploads delta, repeat verification/migration, then approve new production writes and Gateway routing. Never leave two writers for one operational dataset.
11. Prepare valid SSL for play (prefer DNS-01 beforehand), verify local Nginx vhost and host-routing with proper SNI, then change A record to VPS. Smoke-test public site, API, PWA, websocket, streaming, push and billing.
12. Keep staging running in parallel **with sandbox Gateway keys and Mailpit only**. Future stage edits must not enter production without a new, reviewed main-branch release.

## Hard stops
- Missing verified production data, no healthy production DB, mismatched SMTP/Gateway environments, unreviewed live MIT charges, incomplete stage-routed payment mapping, or missing HTTPS validation means **no production cutover**.
- Do not point production `MONGO_URI` to staging, run `docker compose down -v`, replay historical paid webhooks as new charges, or change public DNS automatically.
- These files alone do **not** migrate data and do **not** deploy a live application.

### QA dry-run note
The candidate production backend intentionally rejects login POST and all writes while the cutover flag is 0. Exercise authenticated writes only against staging or after controlled activation with an approved final snapshot. Background jobs are not allowed to run before the flag is approved. Do not infer completion from GET healthchecks alone.

### Ad Network readiness blocker
The current Advertising v2 financial reservation engine requires MongoDB replica-set transactions. The production replica-set overlay prepares an authenticated independent rs0; paid ad settlement still needs verification of transaction readiness, audit trusted geo ingress, reserve/release financial tickets in non-billable integration tests and explicitly approve the financial-delivery flags. Do not turn on `ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED` against standalone MongoDB.
