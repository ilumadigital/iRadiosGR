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
- Staging checkout remains off without `AD_PAYMENTS_SANDBOX_ENABLED=1` and configured ILUMA staging credentials.
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
