# Broadcaster commerce implementation — staging workstream

## Implemented in this branch

- Broadcaster-only Backoffice navigation for **Boost My Radio**, **Pro Features**, **WebDSP** and **Ad Control**.
- Server-sourced station entitlements and catalog pricing in a new responsive commerce experience.
- Premium 119 EUR/month and three separately licensed station add-ons are shown with owned/locked state.
- One-time Boost duration/pricing selection for category and global tiers.
- Old app routes redirect to the Backoffice routes; customer listener navigation no longer contains broadcaster commerce links.
- WebDSP and Ad Control pages are rendered only after a successful authenticated station entitlement check. Existing backend authorization remains intact.
- No financial writes or false payment-success behavior have been enabled.

## Non-negotiable scope rules

| Product | Catalog SKU | Catalog scope | Billing |
|---|---|---|---|
| Broadcaster Premium | B-PREM | broadcaster account | monthly subscription, 119.00 EUR |
| DSP | ADD-DSP | station | monthly recurring, 49.90 EUR |
| Analytics | ADD-AN | station | monthly recurring, 7.90 EUR |
| Ad Control | ADD-ADS | station | monthly recurring, 29.90 EUR |
| Category/Region Boost | BOOST-T-* | station | one-off, chosen fixed duration |
| Global Boost | BOOST-G-* | station | one-off, chosen fixed duration |

All prices include 24% VAT. Premium includes DSP, Analytics and Ad Control for all covered account stations. A separately purchased Boost ranks ahead of Premium Boost in the same placement. Do not turn Boost into an auto-renewable plan.

## Gateway dependency — cannot activate charging yet

The current ILUMA Gateway **MIT** implementation limits consented subscriptions to Listener Premium and the listener winback SKU. It hardcodes 399 cents, a listener-only monthly recurrence, a per-customer single-mandate lookup, and listener-specific renewal webhook correlation. The iRadios local BillingOrder enum, validation, webhook and rights are also listener-only.

A superficial UI button or unverified redirect is not a paid entitlement. The Gateway and iRadios changes below must be developed, independently reviewed, and verified in Sandbox together:

1. Introduce a canonical SKU/scope/resource contract for B-PREM and station add-ons. Prices must be catalog-validated independently in both systems; prohibit client-supplied prices.
2. Support multiple mandates per broadcaster (one B-PREM account mandate and independently cancellable station add-on mandates) with an explicit per-mandate key; no collision with Listener MIT.
3. Extend MIT worker without a hardcoded 399-cent product. Sign product SKU, resource ID, cycle identity, order, amount and environment on each Gateway webhook. Never trust browser state for activation.
4. Create a scope-aware paid-order model in iRadios with unique request/idempotency keys, webhook event replay prevention, lock management, and an atomic paid-cycle grant.
5. Only release station entitlements for owned stations, verified paid and in-period cycles, or active admin complimentary grants. On expiry/revocation, revoke the effective right immediately without deleting user presets or content.
6. For Boost, issue one verified single-charge order per station, tier and duration; calculate expiration on the server only after payment.paid. Never make recurring MIT mandates for boosts.
7. Expose subscription status, renewal schedule, cancel-at-period-end, payment history and payment issues inside Backoffice. Extend branded billing emails with idempotent delivery, without duplicating Listener Premium messages.
8. Verify all scenarios: new purchase; duplicate checkout click; unknown Nexi response; timeout; webhook before checkout response; duplicate/reordered webhook; price/resource mismatch; cross-account station; MIT success/failure; cancellation; expiry; admin grant overlap; purchased Boost vs premium; sandbox-vs-live separation; zero double charges.

### Activation rule

Do not remove the disabled purchase CTAs until the cross-repository changes, Gateway staging product registration, sandbox live UAT, signed webhook/MIT reconciliation and CI checks are confirmed. Production is explicitly out of scope.
