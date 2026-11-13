# Advertising Platform v2 — staging integration checklist

Status: **DRAFT / NOT SAFE FOR DEPLOYMENT**. PR #124 is a development slice; no server or database migration has been run.

## Boundaries

- Existing iRadios ad collections and older Admin ads remain intact.
- New unified campaigns reference existing banner/audio creatives using optional `campaignId`.
- The new Agency campaign editor writes a draft; funding and Admin approval are separate.
- Account ownership is enforced in MongoDB queries.
- A signed Nexi-confirmed `payment.paid` event creates one immutable funding lot keyed by unique Gateway payment ID and quote ID.
- Browser returns, read-only payment lookups and checkout responses **never** credit budget.
- CPM is stored as integer EUR micros. Purchased lots retain their own rate snapshot.
- A new checkout is not attempted while an existing payment remains pending/unknown.
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
- Unknown/unverified geo **cannot match** region/prefecture campaigns. Broad country campaigns remain eligible.

## Gateway deployment dependency

- Companion draft: `ilumadigital/iluma-gateway` PR #17.
- The Gateway's staging SQL migration `database/migrations/2026-11-staging-advertising-budget.sql` needs reviewed manual application **to the staging tenant only**.
- The gateway `ADV-BUDGET` SKU is staging and iRadios app scoped, and does not alter Premium or Broadcaster fixed-price checkout.
- Gateway production is live. A merge/deploy requires a separate change approval and rollback plan.
- Gateway code changes do not automatically deploy. Manual Git redeploy in Hostinger hPanel is required.

## Backend and frontend checks

- GitHub Actions build / staging validations must be green.
- Test signed webhook correlation (wrong amount, campaign/quote mismatches, duplicate paid events, nonce replays, delay/order race, failures).
- Test Mongo unique indexes and single-credit recovery in a disposable staging DB; not covered by source-only CI.
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
