# iRadiosGR — extracted source snapshot (REVIEW REQUIRED)

This package was reconstructed from `iradios_gr_project_dump.txt`, not from an original repository or filesystem tree. It includes text-based backend and frontend sources and NPM lockfiles; it **does not** include MongoDB documents, uploaded media, non-text assets not present in the dump, or an operational staging deployment.

## What was intentionally excluded

- `backend/.env`, `frontend/.env` and all actual credentials
- generated `frontend/dist/*`
- backup metadata and logs
- old production `docker-compose.yml` (contains hardcoded credentials and publicly binds DB)
- `backend/seed-admin.js` and `backend/resetUsers.js` (dangerous maintenance scripts, review separately)

## Changes to source

- Removed hardcoded push notification VAPID private/public key literals, taking them from environment variables.
- Removed hardcoded JWT secret fallback in two controllers. JWT_SECRET must be configured before app startup.
- Added `.gitignore`, Docker ignore files and placeholder `.env.example`.

## BLOCKERS before public staging, GitHub commit, or launch

1. **Manually review and scan all source files for additional secrets and credentials.** Rotate all known-exposed original secrets (Stripe, SMTP, JWT, VAPID, ACRcloud, Nexi, Turnstile) in a coordinated manner.
2. Source contains **many hardcoded `play.iradios.gr` URLs**, including API calls, websocket, station uploads, widgets, SEO and canonical links. These must be made environment-aware **before stage launches**, or stage actions may reach live systems.
3. Stage must disable real outbound email, push notifications, production payments, scheduled jobs and third-party callbacks; set test-mode credentials and a separate MongoDB database.
4. Verify the integrity of missing binary assets, public images and required uploads against original filesystem archives.
5. Align `backend/package.json` and lockfiles (`canvas` appears in manifest but not matching root lockfile); test reproducible Docker image builds.
6. Fix API authorization, SSRF streaming proxy, socket authentication, and webhook idempotency before live migration.
7. Never restore a live customer database directly into a publicly accessible stage. Anonymize sensitive personal/financial records.

This archive is a source recovery aid; it is **not yet a ready-to-run production or staging release**.
