# Commercial go-live: Mailpit-only patch and remaining production gates

This patch captures ALL staged SMTP including Admin login OTP in internal Mailpit. No real checkout is activated.

Staging private environment:
- APP_ENV=staging; SMTP_HOST=mailpit; SMTP_PORT=1025.
- Remove nonempty SMTP_USER, SMTP_PASS, ADMIN_2FA_SMTP_* settings.
- Mailpit must bind only 127.0.0.1:5525; public Nginx /dev/mail/ remains 403.
- The Admin OTP address sales@iluma.gr is the message's destination header, not an actual external delivery.
- If Mailpit fails, Admin OTP login must fail closed. Use authenticated SSH port forwarding to read Mailpit.

After a reviewed merge:
1. Back up staging data and update root-owned /etc/iradios/staging/backend.env without sharing secrets.
2. Run bash ops/check-stage-backend-env.sh /etc/iradios/staging/backend.env
3. Run node ops/check-stage-backend-env.cjs
4. Deploy staging: cd /srv/iradios/staging/app && sudo ./ilumadev.sh
5. Verify OTP in Mailpit and public /dev/mail/ HTTP 403.

Real-money activation is STILL BLOCKED:
- iRadios staging checkout is sandbox-only.
- Gateway production tenant/merchant keys and production release are unverified and default locked.
- Gateway recurring MIT and ADV-BUDGET are presently staging-scoped.
- Staging MongoDB is standalone; financial Ad v2 requires backed-up replica set and majority committed transaction tests.
- Trusted signed visitor geo is not configured and synthetic Attica preview cannot authorize billed delivery.
- Live Nexi merchant UAT, signed callbacks, product billing and renewals, refunds, idempotent debit, invoices, and incident rollback require independent verification.
- Never put production secrets in staging or turn on production by renaming a UI label.

Read-only checks:
  curl -fsS http://127.0.0.1:5511/api/advertising/v2/status
  cd /srv/iluma-gateway/app && sudo bash deploy/vps/check-readiness.sh

Git push never deploys either VPS automatically.
