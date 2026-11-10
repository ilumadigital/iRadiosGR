# iRadiosGR Billing — Phase 1 staging decisions (2026-11-10)

This file records approved business requirements and rollout boundaries. It is not a declaration that payments, renewals, or entitlements are live.

## Approved commercial rules

- Source pricing: `iRadiosGR_Telikos_Timokatalogos_Syndromes(1).xlsx`. 21 SKUs. EUR, 24% VAT included. Storage in integer cents.
- `AG-NEWS` = **14900 cents (€149.00) per campaign per month**, confirmed explicitly by product owner.
- Broadcaster paid add-ons (`ADD-DSP`, `ADD-AN`, `ADD-ADS`) are billed and entitled **per station**, not per broadcaster account. Exact recurring cycle is **not yet confirmed** in the Excel and must remain unset.
- Broadcaster Premium `B-PREM` remains an account-level monthly plan (as described in the Excel). The included WebDSP, Analytics, Ad Control must be available to that account's stations without separate addon charges.
- Broadcaster Premium can select stations to receive its included Premium Boost, but a separately **purchased Boost always outranks the included Premium Boost** in matching placement and visibility. Do not confuse purchased Boost with manual editorial rankings. Premium Boost eligibility, amount and scope still need full placement rules before ranking integration.
- Admin may grant a complimentary subscription to a specific account/station/campaign. This is a **non-paid, admin_complimentary** entitlement, not a payment or financial transaction. It may have optional expiry, must have a recorded reason and grantor, and is revocable without deleting its audit history.
- Pre-existing manually assigned Premium benefits must remain intact until an explicit audited migration. Do not silently convert legacy booleans into paid transactions.
- A gifted Agency campaign does not bypass independent creative approval. Only approved AND entitled, in-period campaigns may become visible.

## Phase boundaries

1. **Phase 1 — code added in this PR:** read-only catalog, policy helpers, admin complimentary grants storage, admin UI, isolated entitlement resolver, regression tests. No new charging, no legacy flag changes.
2. **Phase 2:** integrate entitlement resolver with existing feature gates; migrate or reconcile historical manual grants safely after review. Ensure ownership and station scope across all backend paths and legacy compatibility API.
3. **Phase 3:** Nexi Sandbox one-time first-period Listener Premium signed checkout, verified incoming webhook, idempotent payment activation, reconciliation. No browser-success shortcut.
4. **Phase 4:** Broadcaster paid subscriptions, station add-ons, one-time Boost purchases, separate Agency campaign subscriptions and approval/paid gating.
5. **Phase 5:** subscription expiration, cancellation and dry-run renewal scheduler.
6. **Phase 6:** real recurring MIT/tokenization only after the Gateway exposes and tests that functionality; separate production approval.

## Known dependencies

- Gateway recurring/subscription endpoints currently return HTTP 501. Real automatic renewals must remain disabled.
- Gateway webhook currently uses an internal customer ID and must be correlated via stored payment_id / order_id; do not trust it as the iRadios user ID.
- Stage Mongo topology must be checked before multi-document transactional writes.
- Legacy staging Stripe calls remain blocked.
- Phase-1 tests are not production or payment gateway UAT.
