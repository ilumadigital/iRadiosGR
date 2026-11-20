# Production launch from zero test purchases

This is the **commercial opening baseline**, not a database wipe.

- Deployments: `/srv/iradios/production/app` tracks `main`, `/srv/iradios/staging/app` tracks `staging`. Use manual deployment scripts only; never share Mongo volumes, uploads or private secrets.
- Production retains users/stations/playlists/analytics/uploads, and may retain imported historical Mongo payment documents. Its paid rights come only from **production-scoped, signed Gateway-derived BillingOrders and funding lots**. A staging receipt is not a production entitlement.
- `subscriptions` in iRadios MongoDB are **Web Push subscriptions**, **not recurring billing subscriptions**; do not delete them to reset commercial payments.
- Old user `isPremium`, `activeSubscriptions` and broadcaster profile flags are legacy data and must not grant production rights. Only explicit `production`-scoped, `admin_complimentary` BillingGrants are eligible for complimentary benefits. Staging admin grants are not automatically promoted; review/regrant legitimate benefits individually from the Production Admin.
- An imported pending/sending email queue can resend trial emails when production billing mail is enabled. Reconcile and mark explicitly reviewed staging-origin queue entries as skipped **without erasing the sent-email audit**, before switching `PRODUCTION_BILLING_EMAILS_ENABLED=1`.
- Do not carry over paid advertising budgets. Production funding lots require a separately verified production Gateway tenant, provider payment and transactional ledger.
- The old play.iradios.gr site's actual users, subscriptions, payments and uploads must be independently backed up and assessed before DNS cutover; this staging-clone alone does not establish that old-live history is preserved.

## Safe preflight

```bash
cd /srv/iradios/production/app
sudo bash ops/check-clean-prod-commercial.sh
```

Reports aggregate counts (no user or payment identifiers). Exits nonzero if any **production** paid orders/funding already exist or imported pending billing/advertising emails could be replayed. Admin-issued grants are counted but not blocked. Must re-run after final write freeze and source reconciliation.

## Controlled launch order

1. Audit existing stage-to-production data drift, verified backups and old-live dataset.
2. Finish Gateway legacy `paid/unknown` Nexi reconciliation, externally completed refund and cancellation/deactivation of test MIT contracts. Archive historical transactions; prepare a new clean operational production ledger without blindly truncating a shared MySQL tenant.
3. Freeze stage writes and capture a final consistent snapshot. Reconcile deltas selectively into production without overwriting live changes or reissuing webhooks. Review valid admin grants individually.
4. Reconcile/skip imported pending email side effects. Require **both** Gateway zero-finance preflight and this iRadios preflight to PASS.
5. After data/rights operator sign-off, install root-owned `/etc/iradios/production/data-verified` and run `sudo bash ./ilumaprod.sh` with all charge flags still 0. Verify localhost 5610/5611, TLS, auth, signed Gateway callbacks and streams.
6. Enable production writes and new Gateway-to-play HPP routing only after SSL and account mapping are validated. Test one controlled real first checkout, signed receipt, cancellation and refund.
7. Enable Listener MIT and Broadcaster MIT independently **only** after Nexi merchant MIT permission and full provider contract/renewal UAT. The production cutover, MIT execution and MIT UAT flags are independent.
8. Enable Advertising V2 financial delivery only after actual production funding provenance, replica-set transactions, signed geo ingress, reserve/settle/release tests and explicit financial approval. Then enable billing email delivery after the queue audit.

**No automatic activation:** passing these offline preflights does not prove the external Nexi merchant can execute MIT, or that Gateway webhook delivery and financial ad settlement have passed live acceptance.

## Pending email quarantine (reviewed, production candidate only)

Before turning on `PRODUCTION_BILLING_EMAILS_ENABLED`, run
`sudo bash ops/quarantine-prod-imported-emails.sh --audit`.
Any imported `pending`/`sending` billing/broadcaster/advertising campaign email needs
review: this queue came from the staging snapshot and must not resend old
testing notifications. After reviewing the counts and verifying a current
root-only, checksum-valid production Mongo/Uploads backup, execute:
```bash
sudo bash ops/quarantine-prod-imported-emails.sh --apply \
  /srv/iradios/production/backups/prod-before-verification-<actual-existing-timestamp>
sudo bash ops/check-clean-prod-commercial.sh
```
Do **not** type a fictional backup path. This operation changes only imported
pending email statuses to `skipped` in the independent `iradios_prod` DB;
sent history is retained. It requires no live production frontend/backend
and refuses an already-approved production dataset. Re-run the read-only
preflight before issuing any `data-verified` marker.
