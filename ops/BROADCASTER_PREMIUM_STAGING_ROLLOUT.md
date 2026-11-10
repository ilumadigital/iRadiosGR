# iRadios Broadcaster paid billing — coordinated staging release

**Status:** Staging-release candidate; offline CI is not a substitute for live Nexi UAT or remote hosting verification.

- iRadios PR: https://github.com/ilumadigital/iRadiosGR/pull/86 (branch `feat/staging-broadcaster-premium-backoffice`, base `staging`)
- ILUMA Gateway PR: https://github.com/ilumadigital/iluma-gateway/pull/12 (branch `feat/staging-broadcaster-mit-scoped`, base `staging` — production `main` remains untouched)

## Approved product contract (EUR, VAT 24% included)

| SKU | Amount cents | Scope | Charging |
| --- | ---: | --- | --- |
| B-PREM | 11900 | broadcaster account | monthly recurring |
| ADD-DSP | 4990 | approved owned station | monthly recurring |
| ADD-AN | 790 | approved owned station | monthly recurring |
| ADD-ADS | 2990 | approved owned station | monthly recurring |
| BOOST-T-DAY / WEEK / 2W / MONTH / YEAR | 490 / 2990 / 5490 / 9900 / 89000 | approved owned station | **one-off**, respectively 1/7/14 days, calendar month/year |
| BOOST-G-DAY / WEEK / 2W / MONTH / YEAR | 2900 / 17900 / 34900 / 79900 / 848900 | approved owned station | **one-off**, respectively 1/7/14 days, calendar month/year |

The B-PREM account plan includes unlimited stations, all three station add-on rights, and selectable Premium Boost placement. Only broadcaster-selected owned approved stations receive Premium Boost. An active purchased matching-placement Boost outranks included Premium Boost. Editorial/manual rankings are not rewritten and pre-existing manual rights are not migrated into paid events. One-off Boost never creates MIT or a recurring authorization. Orders use server-owned UTC expiry, not browser-supplied duration.

## Implemented in iRadios PR #86

- Backoffice-only Broadcaster pages for **Pro Features**, **Boost**, **Audience Radar**, **WebDSP**, **Ad Control**, and **Οι συνδρομές μου**.
- Original app routes redirect to these Backoffice tools; Pro modules show owned / locked states based on server entitlements. Active modules open their real tooling, not an inert status label.
- The existing analytics backend checks entitlements per owned station; Audience Radar renders live listeners, historic and live locations, average listen time and recorded Ad impressions, without claiming unsupported device analytics or a server-side dB meter.
- User may start a subscription only with explicit monthly consent. Client never chooses a price or provider merchant reference. The product is sourced from the immutable server catalog.
- Broadcaster checkout generates a per-intent UUID Idempotency-Key. Local unique lock serializes pending checkouts; ambiguous provider results stay locked. Signed lookup of original payment/order only; never replay unknown payment.
- Every minute in STAGING only, a bounded read-only reconciliation worker checks old pending/unknown checkout intents by original request key / Gateway payment ID. It can correlate the missing provider IDs even after the browser closes. **Gateway GET=paid maps only to local pending; only the HMAC webhook can grant access.** Provider outage/timeout never releases the purchase lock.
- Provider-confirmed failed/cancelled first checkout releases only the corresponding pending Broadcaster MIT mandate for a safe new consent/payment attempt. Unknown HPP results remain locked.
- MIT renewal events sign the original anchor day, reserved cycle due timestamp and exact next period-end. iRadios validates these boundaries and correlates each renewal to its *own previous cycle*, so late/out-of-order webhooks cannot add an extra month or change Jan-31 -> Feb-28 -> Mar-31 arithmetic.
- Separate `BroadcasterBillingOrder` paid-cycle ledger prevents Listener Premium regressions. Signed webhook must validate SKU, exact amount, resource ID, environment, HMAC, event nonce and order correlation.
- `payment.paid` is the only activation authority. HTTP redirects and provider status lookups are **not** entitlement grants. Period extensions, MIT, one-off Boost, duplicate webhook and grace prevention are server-owned.
- Paid entitlements are scoped by account or owned station. Public station read-time projection removes expired paid DSP/Ad Control without deleting the persisted user preset. A purchase for station A or a one-off Boost never masks legacy station B.
- Premium Boost selection is gated to entitled broadcasters and owned approved stations; ranking is read-time and respects paid Boost over Premium.
- Subscription dashboard shows status and cancellation per SKU/station, without claiming invoices were issued. Cancellation preserves already paid access through original expiry. Removed/transferred station subscriptions remain cancellable by original payer.
- **Overlap protection:** B-PREM and monthly ADD-* cannot hold parallel auto-renewing agreements for the same benefits. Before creating an HPP session, the backend checks Gateway MIT statuses (including pending/verification_pending/past_due) and any local in-flight orders; it fails closed when unavailable. Owners must stop the *future* ADD-* renewals in “Οι συνδρομές μου” before upgrading to B-PREM; the paid period remains valid. Boost is independent and can be purchased even alongside Premium.
- An account-scoped, five-minute Mongo checkout lease serializes concurrent subscription preflights, preventing cross-tab Premium/ADD-* races while creating Nexi sessions. The owner-key-scoped release cannot unlock a newer request, and unknown Gateway outcomes retain their own durable per-SKU order locks. The lease alone is **not** the source of payment/rights truth.
- Isolated Broadcaster transactional Mailpit outbox uses the same branded email v2 as Listener Premium but its own schema and idempotency keys. After **signed `payment.paid` only**, sends first purchase onboarding (full B-PREM benefits or scoped add-on/one-off Boost) and monthly renewal confirmations. After **provider-acknowledged cancellation**, sends cancellation confirmation. Scanner sends upcoming expiration and expired paid-period notices only for the latest scope period and suppresses redundant alerts when auto-MIT is active and enabled.
- A **signed `payment.failed` automatic MIT event** may queue one support notice per provider payment ID; before actual delivery it reconfirms that the contract remains `past_due` and a newer paid period does not supersede it. Neither a failed renewal nor a reminder ever invokes checkout, retries MIT or grants access.
- Transactional messages explicitly distinguish one-off Boost from recurring subscriptions and include the real paid-through date. **ILUMA handles invoices, retail receipts and AADE/myDATA manually outside Gateway/iRadios.** Neither system creates, files, or emails a fiscal document; a payment confirmation is not an official receipt. Staging uses Mailpit; there is no external SMTP recipient delivery.
- Regression test coverage for policy duration, scope, paid priority, signed events, and legacy-station isolation. Main Listener Premium code paths retain their existing safeguards.

## Implemented in Gateway PR #12

- New `broadcaster_mandates` and `broadcaster_cycles`: independent monthly contracts per broadcaster/SKU/station without changing Listener L-PREM 399-cent mandate logic.
- New `broadcaster_boost_scopes`: immutable paid Boost station linkage so Gateway can sign the station ID in the event, rather than trusting frontend checkout state.
- Gateway HMAC checkout validates SKU and exact catalog price, explicit broadcaster MIT consent, owned-station-format resource, one-off Boost no-MIT, and request-key canonical payload (including station).
- Signed Gateway outcome events contain exact SKU and station; MIT events additionally sign origin, external account ID and cycle timestamp. iRadios correlates them to one reserved payment/order.
- One provider MIT attempt per reserved cycle, strict approved sandbox-only execution gates, no retry after unknown charge, read-only Nexi reconciliation, per-SKU station cancellation/deactivation.
- Server-sourced checkout-return routing to `/backoffice/pro-features` or `/backoffice/boost`; Listener Premium callback remains `/premium`.
- Staging-only CLI migration and catalog registration in `bin/manage.php migrate-staging-broadcaster`. **Never run against production.**

## Gate before staging activation / release

**Keep both following gateway flags at `0` until real MIT approval and a verified controlled sandbox recurring UAT:**

```env
BROADCASTER_MIT_SANDBOX_EXECUTION_ENABLED=0
BROADCASTER_MIT_SANDBOX_UAT_APPROVED=0
```

1. Review both draft PRs. Confirm Gateway Hostinger runtime, actual provider sandbox credentials, and **`APP_ENV=staging`** before any migration. Register staging broadcaster products and scopes with `php bin/manage.php migrate-staging-broadcaster`, then run **`php bin/manage.php audit-staging-broadcaster`**. The audit is read-only: it checks the three Broadcaster tables, all exact SKU prices and that MIT remains locked until approved; it does not contact Nexi or charge anyone. Ensure secrets are stored outside Git and that schema matches.
2. **Gateway staging deployment requires Hostinger shell (not GitHub Actions).** Verify a separate staging checkout for `ilumadigital/iluma-gateway` on its `staging` branch and verify the real Hostinger webroot points to that checkout, not the production `main`. Ensure `APP_ENV=staging` and `PRODUCTION_ENABLED=0`, retain both Broadcaster MIT flags at `0`, then execute `php bin/manage.php migrate-staging-broadcaster` and `php bin/manage.php audit-staging-broadcaster`. Check the staging worker `php bin/work.php staging` using the correct PHP 8.3+/FPM runtime and private secrets — no manual attempt to charge. If Hostinger serves a single checkout deployed from `main`, do **not** switch that checkout automatically; provision an isolated staging deployment first.
3. **iRadios staging deployment requires SSH on the iRadios server.** On the existing staged checkout run `cd /srv/iradios/staging/app && sudo ./ilumadev.sh` only after the Gateway schema/API/readiness check is green. The script enforces `staging` and fast-forward pulls, rebuilds stage containers and checks localhost health. Never deploy the iRadios purchase UI alone or change production URLs/keys.
4. Verify that the public `https://stage.iradios.gr` displays the correct Backoffice and a read-only manual billing check loads; do not run a live Nexi checkout until an authorized human reviews the staging Gateway checkout configuration.
3. Test each checkout: B-PREM, ADD-DSP/AN/ADS for two distinct owned stations, including an upgrade from active add-on that is blocked until future MIT is cancelled, a safe cancelled-addon upgrade with old paid access preserved, simultaneous cross-tab B-PREM + ADD-* checkout serialization, 10 Boost durations/types, explicit monthly consent, invalid owner/station/price/currency, HPP cancel/failed first attempt followed by a new attempt, valid capture, expired benefits, duplicate/out-of-order webhooks, replays, uncertain timeout, and *automated* read-only order recovery after the user closes the browser. Specifically confirm Jan-31 -> Feb-28 -> Mar-31 MIT expiry, no second charge, and no automatic activation from GET=paid.
4. Verify one-off Boost has exact paid station ID and correctly calculated expiry; duplicate active same-SKU boost cannot double-charge. Test paid Global vs Premium boost ranking on matching and non-matching catalog views. Test old hand-configured station presets are not erased on unpaid expiry.
5. Check multiple simultaneous broadcaster contracts and per-contract cancellation; verify Gateway cancellation stops future charges and existing entitlements expire naturally. Confirm failed MIT and provider 404/unknown do not trigger another outbound POST automatically.
6. Execute MIT renewal UAT with real sandbox provider contract lifecycle; only after a verified merchant/provider contract and controlled test should the two flags change to `1`. The first-cycle checkout may be tested while flags are off, but recurring worker execution remains disabled.
7. Validate branded Broadcaster Mailpit previews for **B-PREM, every ADD-*, all Boost types, renewal, cancellation, paid-period soon/expired and declined MIT**. Duplicate webhook and scheduler recovery must send each transactional notice at most once, no generic Listener upsell email, and no unapproved external SMTP delivery. **Manual ILUMA accounting process:** after every confirmed transaction, the ILUMA billing operator manually issues and transmits the appropriate receipt/invoice to AADE/myDATA using their authorized process; customer support must have access to the payment history for reconciliation. **There is no automatic fiscal receipt generation or myDATA integration**, and payment success messages are not tax documents.

**Release separation:** Gateway `main` may be the source of Hostinger auto-deployment. **Do not merge Gateway Broadcaster to `main` when the goal is staging only.** Use a separate Gateway `staging` branch, verify it is not wired to the production deploy, and perform an explicit reviewed Hostinger staging release. iRadios merges only to `staging`. Staging code merges do not by themselves prove remote deployment or Nexi availability.

**Do not enable real MIT/production payments merely because lint/CI is green.** Nexi and Hostinger UAT are independent release gates. Keep the two Broadcaster MIT flags `0` until the provider recurring agreement is verified.
