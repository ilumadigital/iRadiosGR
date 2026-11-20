# iRadios paid advertising V2 — production enablement (default OFF)

This branch does not activate paid ads, change a production database, or
run a paid event. A passing environment preflight proves configuration shape,
**not** source-of-funds reconciliation, merchant acceptance or live delivery.

## Independent gates for play.iradios.gr

- `IRADIOS_PRODUCTION_CUTOVER_APPROVED=1`: only after a verified final
  production data snapshot, SSL/routing, webhook and account reconciliation.
- `IRADIOS_BILLING_ENABLED=1`: verified production-only Gateway credentials.
- `ADVERTISING_V2_PRODUCTION_APPROVED=1`: independent final approval AFTER
  integration tests on replica-set transactional reservations and signed
  webhook funding. Absent/0 by default.
- `ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=1`: enable only when everything
  above is true and delivery/trusted-geo secrets are configured.

Listener tickets also require verified geo ingress and a healthy MongoDB
replica-set primary with sessions. There is no stage-only QA preview or
legacy CPM receipt fallback for a paid production ticket. The receipt is
charged only when its qualified event is atomically settled.

## Data provenance

New signed ADV-BUDGET paid events record the Gateway tenant on their funding
lot. Production reads ONLY `environment=production` lots. Staging reads
`environment=staging` and legacy unscoped lots. An initial stage snapshot
cannot confer advertising spendable funds or deliver paid impressions on play.

Historical real production-to-stage-routed funding must be reconciled against
the Gateway **production tenant** and Nexi provider order. When justified,
write an explicitly audited idempotent migration that preserves the original
payment, quote, campaign, remaining wallet and settled receipts. Never update
all staging lots to production or replay a webhook into duplicate funding.

## Tests and go-live controls

Run the offline `backend/tests/advertisingV2ProductionFunding.test.cjs` and
`ops/check-production-split.test.cjs`; perform billable audio/visual
transaction tests on an isolated replica set using synthetic funds. Before
launch check asset streaming, trusted Nginx ingress, quota compensation,
concurrent reserve/settle/release, bid/price snapshots and financial audit.

Keep `ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=0` and
`ADVERTISING_V2_PRODUCTION_APPROVED=0` on the VPS until explicit final
go-live authorization. Git push alone deploys nothing.
