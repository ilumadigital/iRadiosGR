# Advertising Platform v2 — staging integration checklist

Status: **DRAFT / NOT SAFE FOR DEPLOYMENT**. PR #124 is a development slice; no server or database migration has been run.

## Boundaries

- Existing iRadios ad collections and older Admin ads remain intact.
- New unified campaigns reference existing banner/audio creatives using optional `campaignId`.
- The new Agency campaign editor writes a draft; funding and Admin approval are separate.
- Account ownership is enforced in MongoDB queries.
- A signed Nexi-confirmed `payment.paid` event creates one immutable funding lot keyed by unique Gateway payment ID and quote ID.
- Browser returns, read-only payment lookups and checkout responses **never** credit budget.
- CPM is stored as integer EUR micros. Purchased lots retain their own rate snapshot. The isolated `advertisingCpmMath` module proves exact per-event nano-EUR arithmetic (1 EUR = 1,000,000,000 nanos) and includes safety tests; no live event-debit writes or settlement ledger have been enabled.
- A new checkout is not attempted while an existing payment remains pending/unknown. A sparse unique `activeLockKey` prevents concurrent checkouts against different quotes of the same campaign; signed terminal events release it. Mongo financial unique indexes are verified before any outbound checkout or paid credit.
- Tax policy is deliberately `unconfigured` until explicitly set by the Admin.
- Staging checkout remains off without `AD_PAYMENTS_SANDBOX_ENABLED=1` and configured ILUMA staging credentials. The default is `0` in `backend/.env.example`; `compose.stage.yml` deliberately does NOT override this private value. Only an approved operator may opt in using `/etc/iradios/staging/backend.env` after confirming the Gateway's independent `ADVERTISING_STAGING_CHECKOUT_ENABLED=1` switch and the staging SQL migration. Keep `AD_DELIVERY_BILLING_ENABLED=0`: paid impression delivery is a separate, still-disabled release gate.
- **CRITICAL: Billable CPM settlement and its atomic ledger are NOT implemented; `AD_DELIVERY_BILLING_ENABLED` MUST remain unset/disabled.** Do not serve new prepaid v2 campaigns until a transactional, idempotent delivery engine is in place.
- Legacy ads without a `campaignId` continue their existing policies; paid v2 isolation is not a legacy migration.

## Geo targeting

- UI allows Country → Region → Prefecture, never city.
- The public advertising endpoints resolve geo server-side using `trustedAdGeo`.
- The reverse proxy MUST overwrite and generate all `X-IRadios-Geo-*` headers, including `X-IRadios-Geo-Auth`, and be bound to trusted Cloudflare IP ranges or a trusted GeoIP service.
- Set `IRADIOS_TRUSTED_GEO_SECRET` to a unique random secret of at least 32 bytes. Configure the *same* secret only within the private reverse proxy; do not publish it to browsers or send it via client-side JavaScript.
- The proxy must supply normalized Greek labels from `stationLocationData.json` for country, region and prefecture. Current Cloudflare raw city/region headers are not sufficient on their own. Never pass raw untrusted `CF-Region` through as if trusted.
- Unknown/unverified geo **cannot match** country, region or prefecture campaigns. Verified country-only Greek geolocation can match nationwide Greek campaigns; fully general (`All`) inventory may still match unknown visitors.

## Gateway deployment dependency

- Companion draft: `ilumadigital/iluma-gateway` PR #17.
- The Gateway's staging SQL migration `database/migrations/2026-11-staging-advertising-budget.sql` needs reviewed manual application **to the staging tenant only**.
- The gateway `ADV-BUDGET` SKU is staging and iRadios app scoped, and does not alter Premium or Broadcaster fixed-price checkout.
- Gateway production is live. A merge/deploy requires a separate change approval and rollback plan.
- Gateway code changes do not automatically deploy. Manual Git redeploy in Hostinger hPanel is required.

## Backend and frontend checks

- GitHub Actions build / staging validations must be green.
- Test signed webhook correlation (wrong amount, campaign/quote mismatches, duplicate paid events, nonce replays, delay/order race, failures).
- Test Mongo unique indexes, concurrent cross-quote checkout locking, terminal-event unlocking and single-credit recovery in a disposable staging DB; not covered by source-only CI.
- Test Mailpit notification outbox retries for paid pending approval, approved/activated, top-up; exhaustion email awaits atomic billing event handling.
- Validate all Agency revisions are held until Admin approves; keep the last approved creative live.
- Test visual 50% for continuous 1s and audio audible 30s qualification **before enabling billable delivery**.
- Verify VAT, unused budget/refund policy and default CPM with the business owner before enabling checkout.
- Verify actual provider Nexi Sandbox UAT before calling the flow operational.

## Deployment (ONLY after all gates)

1. Gateway: security review, final tax policy, manual staging SQL migration and separate authorization; manual deploy via Hostinger hPanel.
2. iRadios: merge PR #124 into `staging` only after compatible Gateway is tested.
3. Apply staging on VPS with `cd /srv/iradios/staging/app && sudo ./ilumadev.sh`.
4. Verify quote/checkout/webhook/recovery, admin permissions, Mailpit, geo proxy and qualified delivery in staging.
5. Do not deploy paid v2 to production without explicit separate approval.

No SSH commands, DB modifications, Gateway redeploys or paid Nexi transactions were executed while building these draft branches.

## Atomic CPM settlement foundation (source only — not delivery enabled)

A server-only claim/settlement service and unique `AdvertisingBillableEvent` ledger now exist. Incoming signed `payment.paid` events create new funding lots with both integer micros and canonical **nano-EUR** balances (10,000,000 nanos per euro cent). Existing legacy micros-only lots must undergo a reviewed backfill before they are eligible for debit; no automated financial migration has been performed.

A qualified event permanently claims exactly one funding lot and its historical CPM. The ledger `_id` is unique. A conditional single-document MongoDB update decrements `remainingNanos` and appends the **immutable receipt inside the same funding lot**. It also refreshes `remainingMicros` as a compatibility projection. Replays, races and uncertain network responses recover using the original event ID and the lot's durable receipt; a pending central ledger status can be reconciled without issuing another debit. No MongoDB multi-document transaction is assumed.

**Important limitations / hard-stop gates:**

- The settlement engine has **NO public route** and is not wired to qualified delivery. The existing `ATOMIC_SETTLEMENT_IMPLEMENTED=false` source gate stays in place. Do not change this just because financial core code exists.
- No independently verified visual viewability ticket, audio audible-proof protocol, frequency cap, anti-fraud scoring or pacing engine is connected yet. Neither a browser counter nor a media fetch authorizes a charge.
- The embedded event receipt journal is **bounded at 6,000 events per funding lot** and deliberately fails closed at capacity. Implement and validate a durable partitioned wallet/ledger design before enabling high-volume public delivery; do not erase receipts to bypass the cap.
- The new `GET /api/admin/advertising/campaigns/:id/reconciliation` is read-only, Admin-only and bounded. It checks the lot balance against its receipts and the global ledger; any mismatch is a blocker. The Admin v2 UI offers a read-only “Οικονομικό audit” action.
- The `advertisingSettlementRecovery` routine is **manual/unwired**. It must not execute automatically against active finances until staging tests confirm consistency.
- Automated source-CI simulations cover duplicate event IDs, 100 concurrent replays, competing debits, crash-after-debit and ledger-finalization failure. They are **not** real MongoDB concurrency tests.
- A separate Mongo test harness exists at `backend/tests/advertisingCpmMongoDisposable.cjs`. It **refuses** any URI that does not explicitly name a dedicated `ad_cpm_disposable_*` database, and requires `APP_ENV=staging`. Only run with a dedicated test database/credential and after reviewing the DB target. It has NOT been run from this chat.
- Refunds, adjustment journal, financial reversals, exact-once notification sends, budget-exhaustion email lifecycle and signed Nexi Sandbox E2E remain to be implemented and verified.

**Non-negotiable:** No paid rollout, checkout switch, financial migrations, merging or SSH/Hostinger deployments based solely on CI success. Review the financial policy, immutable receipt capacity, verified qualification and true Mongo recovery first.

## Scalable CPM settlement v2 — replica-set transaction prototype

A **separate, unwired** `advertisingTransactionalSettlement` adapter now supports `settlementMode: mongo_transaction_v2`. It writes the remaining funding-lot balance and the immutable `AdvertisingBillableEvent.status=charged` receipt **inside the same MongoDB snapshot/majority transaction**. Unlike the earlier embedded-receipt prototype, it does not append to a 6,000-event array and therefore avoids that receipt capacity limit. The charged event is the ledger receipt; retries and ambiguous commit responses read the original unique event marker, never issue a separate standalone debit.

**Do not use transaction mode on standalone MongoDB:** it requires an actual replica set with majority writes and verified transaction retry semantics. The currently signed Gateway funding path still explicitly creates `embedded_receipts` lots; an operator may not flip modes by environment flag or mutate an already-used lot. A controlled payment/mode migration and new-funding cutover require financial review. Legacy embedded receipt and new transactional paths are mutually exclusive, including manual recovery. A staging-only, explicit-approval manual recovery guard remains in place.

Source CI simulates 100 simultaneous duplicate requests, 80 competing independent charges, unknown commit results and transaction rollback. There is also a **manual-only** replica-set test: `backend/tests/advertisingCpmMongoTransactionalDisposable.cjs`. It rejects non-disposable DB names and requires both `APP_ENV=staging` and `AD_CPM_DISPOSABLE_APPROVAL=I_CONFIRMED_TEST_ONLY_DATABASE`. The older embedded-receipt integration harness now requires the same protection. Run both only with an independently checked, dedicated test database and least-privilege test credentials, never against the actual staging app database. **Neither database harness was executed in this development session.**

## Budget exhaustion and Agency finance visibility

`advertisingBudgetAffordability` evaluates actual **nano-EUR** funded balances against each funding lot's **historical CPM** and the currently active Visual (standard/hero) and Audio placements. It does not merge two insufficient lots into a fictional billable impression, report a 6,000-receipt technical capacity block as an exhausted wallet, or trust old micros-only lots for charge decisions. The Agency `/finance` response and budget/top-up UI now distinguish: funded, exhausted, below the next-event price, no approved creatives, not funded, technical capacity blocked and needs financial review.

`advertisingBudgetExhaustionNotifier` prepares the already-branded Mailpit `budget_exhausted` email and deduplicates per **verified funding generation**; a new signed top-up produces a new generation. It refuses to notify on unknown, invalid or mixed-source balances. The outbox now tolerates racing unique-key upserts.

**Important:** Exhaustion notifications are not connected to a live qualified settlement event or background scheduler yet, and therefore **are not automatically sent by these source changes**. Wire them only after authorized paid delivery, eligibility, pacing and qualification are complete. The current hard-disabled v2 delivery flag must remain false.

Remaining blockers include real MongoDB replica-set E2E, true Nexi Sandbox paid/refund flows, trusted GEO source verification, real visual/audio billable qualification and fraud controls, pacing/rotation, Agency revision transaction safety, durable per-recipient approval emails, explicit tax/business approval, and approval before any manual deployment.


## 2026-11-13: Qualified Delivery / Pacing SHADOW QA (not paid)

SOURCE-ONLY; NOT DEPLOYED. The permanent safety gate
ATOMIC_SETTLEMENT_IMPLEMENTED=false remains in
backend/services/advertisingDeliveryEligibility.js. Public paid v2
inventory remains closed. Gateway PR #17, Nexi, finance and servers untouched.

### New non-billable implementation

- advertisingQualifiedDelivery.js: HMAC-signed, 120-second capability tickets
  bound to server-derived pseudonymous request fingerprint; sequential server
  heartbeat-time checks, replay detection and impossible audio progress guards.
- AdvertisingDeliveryTicket: short-lived Mongo state with compare-and-swap seq.
  AdvertisingQualifiedEvent: durable, unique shadow-only audit (billable=false).
  AdvertisingDeliveryCounter: atomic campaign quotas and frequency counters.
- Visual: >=50% viewport, continuously >=1 second; Hero >=2 seconds.
  Low ratios, hidden tabs and >2.5-second heartbeat gaps reset the clock.
- Audio: duration measured server-side by ffprobe and vetted local media file.
  Qualification needs continuous reported audible foreground playback of
  90% of audio duration, capped at 30 seconds. This remains separate from the
  UI skip rule (<=30 seconds cannot skip, longer spots skip after 30 seconds).
- Anti-fraud: short capabilities, monotonically advancing heartbeat sequence,
  audio progression bounded by server elapsed time, invalidation on stream
  changes/errors. Privacy-aware IP/UA HMAC fingerprints are coarse, not identity.
- Pacing: hourly cap based on historical CPM and currently verified balances;
  additional five-minute cap and fair under-served/quota selection; per-fingerprint
  limits of 60 shadow tickets/hour, three/campaign/hour and one/campaign/10 min.
- advertisingShadowSettlementPreview.js: read-only historical-rate cost preview,
  without charging, creating financial claims or invoking settlement adapters.

### Strict operator QA route contract

Routes require authenticated Admin and staging, and return 404 unless both
server-only settings exist (OFF by default):

AD_QUALIFICATION_SHADOW_ENABLED=1
AD_QUALIFICATION_SHADOW_SECRET=private_random_secret_at_least_32_bytes

Never commit the secret or expose it to browsers. Do not enable ordinary
staging/production traffic on this basis.

POST /api/admin/advertising/shadow/ticket
  JSON kind=visual, placement=home (or kind=audio, placement=audio).
POST /api/admin/advertising/shadow/heartbeat
  JSON capability and report. Visual reports: seq, ratio, foreground.
  Audio reports: seq, positionMs, foreground, playing, muted, volume,
  error, streamChanged.
GET /api/admin/advertising/shadow/events/:id/financial-preview
  Read-only affordability estimate; cannot charge.

### Remaining hard blockers

These are client-reported signals bounded by the server clock, NOT proof of a
real human impression or audible speaker output; a custom client can fake
signals in real time. No public player/banner integration exists, and shadow
events MUST NOT be recycled as payable financial events.

Required before payment: real frontend QA, browser/proxy fraud analysis,
independent human-traffic policy, geo proxy validation, multi-process MongoDB
CAS/index/integration tests, approved creative updates under concurrency,
real Mongo replica-set financial settlement/reconciliation, budget exhaustion
outbox, Nexi Sandbox and Mailpit E2E, refund/tax approvals, and authorized
deployment. No SSH deployment, merge, SQL migration or Gateway redeploy.

CI test: node --test backend/tests/advertisingQualifiedDelivery.test.cjs

Manual MongoDB concurrency harness (NOT run):
backend/tests/advertisingQualificationMongoDisposable.cjs. It requires
APP_ENV=staging, a dedicated ad_qualification_disposable_* MongoDB database,
AD_QUALIFICATION_DISPOSABLE_MONGODB_URI and the explicit approval phrase
AD_QUALIFICATION_DISPOSABLE_APPROVAL=I_CONFIRMED_TEST_ONLY_DATABASE.
This test is not part of CI and must never target a real staging or production DB.


## 2026-11-13: Legacy viewability and crash-recoverable Agency approval

This is a second SOURCE-ONLY development slice in Draft PR #124. It does
not enable paid Advertising v2 or turn on shadow diagnostics.

### Browser-side, NON-BILLABLE legacy impressions

- AdPlacementLink now uses adViewability.js, backed by IntersectionObserver.
  It waits for >=50% foreground visibility continuously >=1 second (Hero
  >=2 seconds) before sending the pre-existing legacy /impression request.
- Background tabs, lost intersection, unmounted elements and unsupported
  browser observation APIs fail closed. Multiple renders and duplicate slots
  remain deduplicated by the existing page-session Set.
- This remains an unaudited LEGACY analytics counter. V2 creative delivery
  and all CPM settlement services remain hard-disabled. The client can still
  forge requests; this change does not turn legacy impressions into proof of
  a paid human view.
- Browser-like deterministic tests cover geometry, visibility transitions,
  timers, re-entry, cleanup and missing IntersectionObserver.

### Compensating shadow pacing quota reservations

- Quota admission is still an atomic Mongo findOneAndUpdate per counter;
  the new advertisingTicketReservation helper releases only this attempt's
  won quotas if a later constraint or ticket creation fails.
- Server checks that Audio files can be probed BEFORE quota admission.
- Multi-document reservations are NOT a MongoDB transaction. A process crash
  can temporarily strand conservative quota; it cannot issue a paid debit.
- Source tests cover concurrent candidates, partial quota failures, rollback,
  ticket-insert error and lack of financial integration.
- This is shadow QA only. Real multi-process Mongo tests are mandatory.

### Agency Admin approvals: pending until creative commit

- A revision remains status=pending and processing=true while an Admin
  approval is being applied, so the existing unique pending-revision index
  blocks a second Agency submission for the same creative.
- The approved patch and lastApprovedRevisionId marker are written in the
  SAME atomic creative Mongo update, guarded by the original updatedAt.
- Only after this marker is present does the revision become approved.
  If the server crashes after that creative update, the same Admin approval
  can safely resume; it observes the marker and never replays the patch.
- If the creative changed concurrently or recovery cannot prove the marker,
  the revision stays pending/processing and reports needs_manual_review.
  It must NOT automatically roll back and expose a stale pending revision.
- Admin CampaignEditor displays an explicit retry button for in-flight
  approval, and disallows rejection during recovery.
- Before accepting new Agency revisions, createIndexes verifies the unique
  pending index; failure blocks submission rather than silently accepting
  duplicate review requests.
- Rejection still uses a single pending -> rejected conditional update and
  never writes creative fields.

### Remaining critical financial and operational blockers

UPDATE: This direct-send limitation was replaced in the later durable Agency
notice outbox slice below. Actual disposable MongoDB concurrency and Mailpit
E2E tests are still outstanding; HTTP success is NOT proof of inbox delivery.

Actual Mongo concurrency/index verification, browser E2E, trusted geo,
audio anti-fraud validation, payment/top-up/refund tax approvals, signed Nexi
Sandbox and financial settlement tests remain mandatory. No merge, staging
SSH deploy, SQL migration, Gateway modification or production redeploy.

New regressions:
node --test frontend/src/utils/adViewability.test.js
node --test backend/tests/advertisingTicketReservation.test.cjs
node --test backend/tests/agencyRevisionApproval.test.cjs


## 2026-11-13: Durable Agency draft / revision / decision emails (source-only)

**NOT DEPLOYED / Draft PR #124.** New Agency draft and revision notification
paths no longer send SMTP directly in their create/approval HTTP request.
They store version-1 source markers, then seed per-recipient durable notices.
The worker attempts sending asynchronously in staging ONLY. The only
transport reachable under APP_ENV=staging is the internal Mailpit SMTP
host at mailpit:1025 via the existing myMailer module. Never point staging
directly to production SMTP.

### Durable event protocol

- New model AgencyAdNotice has one unique eventKey per kind, immutable source
  identifier and individual recipient User ID. Kinds: draft_submitted,
  revision_submitted, revision_approved and revision_rejected. Each record
  snapshots recipient address, validated subject and HTML, scoped creative,
  agency and revision identifiers, status, attempt count, retry schedule,
  lease token, lease expiry and SMTP-accepted message ID.
- All templates inherit the existing branded iRadios email shell. Revision
  submissions include sanitized before/after changes; rejections include the
  Admin reason. Approval links lead only to the authenticated Backoffice,
  never to a one-click email decision URL.
- Mongo's unique eventKey index is verified before any queue upsert. New
  documents are inserted through setOnInsert only; duplicate calls cannot
  overwrite message snapshots or create a second queue entry.
- New revisions have noticeVersion=1, submissionOutboxSeededAt and
  decisionOutboxSeededAt; newly created Agency banner/audio drafts carry
  agencyDraftNoticeVersion=1 and draftOutboxSeededAt. Existing imported
  and previously notified records remain version 0 and are NOT replayed.
- The worker periodically scans unseeded new sources (including already
  committed approvals/rejections) and rebuilds any missing notices. Thus a
  crash between a creative/revision commit and a queue insert can recover
  without a second Agency action. On already-final revisions, a retroactive
  Admin review request is skipped; the final Agency decision email is still
  recovered independently.
- A Mongo findOneAndUpdate claims a due notice with a random lease token,
  six-hundred-second lease and attempt counter. Only the owner of that
  lease may mark it sent, retry-pending or superseded. Retries use
  exponential backoff capped at one hour. Pending Admin requests for already
  decided revisions or already-approved drafts are marked superseded rather
  than misleading recipients with old review instructions.
- SMTP accepted does NOT equal inbox delivered. The worker offers
  **at-least-once** semantics, NOT exact-once: after an SMTP ACK and before
  the sent-status Mongo commit, a crash/unknown DB outcome may produce a
  second Mailpit message. Each eventKey/recipient has one durable queue row.
- Existing AdvertisingCampaignMailScheduler is separate and remains subject
  to its own readiness checks; this Agency notice slice does not authorize
  paid campaign activation, changes to financial settlement or budget emails.

### Admin diagnostics

GET /api/admin/agency-ad-notices is read-only, authenticated Admin only
and staging-only. It returns recent entries with the email HTML excluded.
The Admin Advertising v2 Campaigns page offers a purple Mailpit outbox
summary with pending/sending/sent/superseded counters, recipient emails,
attempt count and errors. It cannot modify, purge or mark notices sent.

### Required manual UAT BEFORE treating notifications as operational

1. Use a DEDICATED disposable staging MongoDB (never iradios_stage or a
   production database) and dedicated Mailpit; verify URI, recipient
   isolation, network and backup policy before connecting.
2. Validate concurrent duplicate revision submissions, partial per-recipient
   queue inserts, unique key indexes and one Admin email per unique address.
3. Create a throwaway pending Agency banner and audio, change both, and
   review each through the authenticated Admin editor. Check Mailpit HTML
   (logo, escaped values, correct before/after, correct CTA links, no email
   approval bypass), sender, subject and per-recipient entries.
4. Check Admin approve and reject decisions; ensure the Agency receives
   only the final appropriate decision and rejection reason.
5. On the **isolated test** stack, interrupt Mailpit before delivery and
   verify pending/retry/backoff; restore it and confirm a single persisted
   sent marker per recipient. Simulate interruption after source commit
   but before queue insertion, restart and verify the reconciliation scan.
6. Simulate an ambiguous SMTP ACK followed by interrupted Mongo finalization;
   record that a duplicate mail CAN occur. Verify no financial balances,
   Gateway events or paid impressions are touched.
7. If any source cannot seed its recipient notices, inspect app logs and
   read-only Admin notice list; do NOT clear indexes or manually mark sent.

Source-only regressions:
node --test backend/tests/agencyAdNoticeOutbox.test.cjs
node --test backend/tests/agencyRevisionApproval.test.cjs

Source unit tests still use deterministic fake leases. A separate disposable
GitHub Actions job now exercises actual MongoDB and Mailpit SMTP, including
fault injection; see the CI evidence below. Browser/backoffice and real
staging tenant/real-provider inbox UAT have NOT been performed. No SSH
deployment, SQL migration, Nexi checkout, Gateway change or Git merge.


### Guarded disposable MongoDB test harness (CI-only execution verified)

backend/tests/agencyAdNoticeMongoDisposable.cjs performs real MongoDB
per-recipient index, 80 concurrent duplicate upserts, 70 competing claims,
expired lease recovery and stale-worker fencing without sending ANY email.
It requires all of:

- APP_ENV=staging and NODE_ENV not equal to production
- AD_AGENCY_NOTICE_DISPOSABLE_APPROVAL=I_CONFIRMED_TEST_ONLY_DATABASE
- AD_AGENCY_NOTICE_DISPOSABLE_MONGODB_URI pointing to a NEW, isolated
  ad_notice_disposable_<unique> database (never iradios_stage or Gateway DB)

The harness only deletes its own random event keys; it never drops a
collection/database or executes a financial mutation. It has now run ONLY
inside a GitHub-hosted disposable MongoDB service. Review the URI and
credential scope before any manual execution; never point it at live
staging or production data.

This harness intentionally never calls sendEmail. The NEW, separate
backend/tests/agencyAdNoticeMailpitCI.cjs now exercises the application
mailer through an isolated Mailpit SMTP service, but hands-on Backoffice
approval and real staging tenant testing remain required. Even after CI,
the email protocol remains at-least-once.


### Evidence: real disposable MongoDB + Mailpit GitHub Actions, 2026-11-13

Workflow: .github/workflows/agency-notice-integration.yml
CI verification (current slice): GitHub Actions run #43471800091, PASSED.
Validated head: 033fa3fc66c01e7d6cbbcbdce1a682ca06149690.

This separate pull-request-only job uses the node:22-bookworm job container
and isolated service containers mongo:7.0 and axllent/mailpit:v1.32.0.
It has NO application/Gateway secrets and does not publish the database or
SMTP service to the public network. Mailpit accepts only throwaway
@example.invalid recipients. No production provider is configured.

- The pre-existing Mongo disposable harness was exercised against only
  ad_notice_disposable_ci_20261113: 80 duplicate concurrent recipient
  upserts, two unique recipient records, 70 simultaneous claims and a
  token-fenced expired-lease recovery. The database is ephemeral to the job.
- The new Mailpit integration exercised the real Agency notice
  persistence -> worker -> existing myMailer SMTP path. It verified 2
  separate Admin approval-request emails, one final Agency approval email,
  one final Agency rejection, branded HTML, escaped malicious fragments,
  sender/recipient correctness and no repeated sends after rerunning the
  recovery scan. The actual Mailpit REST inbox was inspected per message.
- The chaos-enabled Mailpit server rejected additional messages with SMTP
  code 451. The outbox persisted the per-recipient SMTP errors and backoff
  without marking them sent. After restoring SMTP and advancing retry due
  time ONLY in the disposable test database, the worker retried and both
  messages were accepted exactly once in that controlled scenario.
- CI also verifies the paid-delivery hard-disable. No qualified shadow event
  was converted into a billable CPM event and no Gateway operation occurred.

IMPORTANT: This is automated GitHub Actions integration, not a staging VPS
deployment or evidence of deliverability to a real Gmail/Outlook inbox.
Mailpit acceptance is not inbox placement. Deliberate transport ambiguity
can still result in duplicate email in at-least-once systems. Browser UI
and full authenticated HTTP approval UAT remain required before rollout.

CI dependency note: the current backend package-lock.json predates
the canvas dependency declared in package.json, so npm ci fails with a
lockfile mismatch. The NEW isolated integration workflow uses a separate
temporary test-only install of pinned mongoose 9.2.4 and nodemailer 8.0.1
without modifying the application's production lockfile. Repair and
review the backend dependency lockfile before any staging/production
application deployment; passing this isolated CI job does NOT mean the
backend lockfile is ready for a full clean install.
