# iRadiosGR — Public staging with Cloudflare, without HTTP Basic Auth

This staging configuration removes the repeated browser password prompt **for the radio frontend only**.
Listener and Agency registration is intentionally available with server-verified Cloudflare Turnstile; Broadcaster registration remains invitation-only.
The staging database contains a snapshot of real production identities; anonymous requests
must only reach public radio endpoints. Keep sensitive API operations behind stage-only JWT.

## Local HTTPS and Nginx first
Deploy the updated staging branch. Verify that the backend guard responds with
`200` to `GET /api/stations` without JWT and `401` to `GET /api/admin/users`
or `GET /api/auth/me` without JWT. Then back up/install `ops/nginx-stage.conf`,
run `nginx -t`, and reload. Run `bash ops/test-public-stage.sh`.
- `/`, `/api/stations`, `/api/proxy-stream`: public.
- `/api/admin/*` and other private API calls: JWT admin only.
- `/api/auth/login`: verified users with mandatory Turnstile Siteverify and IP rate limit. Imported accounts remain sensitive.
- `/api/auth/register`, `/api/auth/register-agency`: rate-limited public signup with mandatory backend Cloudflare verification, and private Mailpit OTP delivery.
- `/api/auth/register-broadcaster`: valid, email-bound invitation plus mandatory Turnstile.
- `/api/auth/verify-otp`: rate-limited, six-digit OTP verification; Mailpit is never publicly available.
- `/api/auth/turnstile-config`: public site key only, never secret.
- `/dev/mail/`: 403. `/api/socket.io`: 403 (legacy unauthenticated handlers).
- Only radio assets, promo visuals and logo subdirectories under `/media/` served.
- Imported production advertising is not served in staging.
- Public host remains `X-Robots-Tag: noindex, nofollow, noarchive`.

## Cloudflare Turnstile credentials (required before staging deploy)
Create a Turnstile widget in Cloudflare Dashboard with allowed hostname
`stage.iradios.gr`. In `/etc/iradios/staging/backend.env` configure:
```dotenv
TURNSTILE_SITE_KEY=<Cloudflare public site key for stage.iradios.gr>
TURNSTILE_SECRET_KEY=<matching private Cloudflare secret>
```
Do **not** use Cloudflare's always-pass test keys on public staging.
No frontend VITE keys are required: the public site key comes from
`GET /api/auth/turnstile-config`. The secret never reaches browsers.
Preflight fails closed if these values are missing or use known test keys.
After deployment, test a new Listener registration and check private Mailpit
on the VPS; do not paste OTP codes or secrets into logs.
## Cloudflare account configuration (manual: no connected Cloudflare account)
1. On the VPS, check authoritative nameservers: `dig +short NS iradios.gr`.
   **Only** if `iradios.gr` is already an active Cloudflare DNS zone should you
   change the single existing `stage` A record to **Proxied**:
   `stage.iradios.gr -> 185.230.64.89`. TTL Auto.
   Do **not** alter `play.iradios.gr` or apex records, production MX/TXT records,
   or change the domain's nameservers as part of this staging task.
   If Cloudflare is not authoritative, DNS-only stage remains valid for now;
   a deliberate full-zone migration/plan review is needed before orange-cloud.
2. Cloudflare > SSL/TLS > Overview: **Full (strict)**; Hostinger has Let's Encrypt
   for `stage.iradios.gr`. Keep HTTPS redirect and cert on the origin.
3. Cache Rules: **Bypass cache** for hostname `stage.iradios.gr`
   and paths starting `/api/` (including live `/api/proxy-stream`),
   `/dev/mail/`, and any auth-sensitive path. The origin also sets
   `Cache-Control: private, no-store`.
4. Configure WAF/rate limiting for `/api/auth/login` and expensive public endpoints.
   Do not disable TLS verification or switch to Flexible SSL.
5. Verify from a separate client:
   - `curl -I https://stage.iradios.gr/` should show HTTP 200 with no
     `WWW-Authenticate` header.
   - `curl -I https://stage.iradios.gr/dev/mail/` returns HTTP 403.
   - `curl -I https://stage.iradios.gr/api/admin/users` returns HTTP 401.
   - `curl -sS https://stage.iradios.gr/api/stations` gives public radio JSON.
   - `curl -I https://stage.iradios.gr/` should show `server: cloudflare`
     and/or `cf-ray` **only once the proxied record is actually active**.

## Stream troubleshooting
On Hostinger: `bash ops/diagnose-radio-streams.sh 10`.
- `HTTP 200 audio/* N bytes` indicates actual bytes from a station through the
  safe proxy. If the browser still fails, inspect its DevTools > Network,
  especially `/api/proxy-stream` and browser media/CORS errors.
- `HTTP 400` indicates unsupported/unsafe upstream URL/port; record the station
  name without exposing secret URLs.
- `HTTP 502` may indicate unreachable broadcaster stream, DNS failure,
  upstream Content-Type/redirect problem or timeout. Resolve per-station.
- `HTTP 403` on a genuine station means source URL did not match an approved
  stream in stage; verify the station data and proxy selection logic.
- Streams are continuous responses. If the Cloudflare proxy causes buffering,
  first test origin using the local --resolve smoke script. Do not open
  private-IP access or unrestricted outbound proxying.

## Important privacy caveat
A public stage backed by imported live account hashes is more sensitive than an
ordinary demo environment. No private user data should be present on public API
responses. Admin-only authentication is a temporary safety measure: a separate
anonymized demo database and full authorization review are recommended before
inviting general public traffic. Never publish JWT_SECRET, Mongo passwords or
Cloudflare API tokens in the repository.
