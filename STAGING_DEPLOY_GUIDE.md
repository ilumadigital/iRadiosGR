# iRadiosGR — First safe staging candidate

This is a **candidate package, not yet a verified build**. It is intended for the isolated Hostinger VPS at `stage.iradios.gr`, **not** production. Review files before deploying. Original archive is reconstructed from a text dump; absent binaries and actual database/uploads must be supplied separately.

## Key stage-only protections
- Every known `https://play.iradios.gr` string in the provided text source was converted to `__IRADIOS_SITE_ORIGIN__`. Docker builds replace it with `https://stage.iradios.gr` **before starting the app**. This initial build strategy must be improved to runtime configuration before promoting the same image to production.
- Removed hardcoded Stripe live **publishable** keys from React pages; no Stripe publishable key is provided in stage builds.
- API stage guard returns 503 for **all payment endpoints**, outbound push, recognition, and potentially unsafe arbitrary-URL metadata/stream-proxy endpoints. These features are intentionally restricted pending dedicated security fixes.
- Email is captured by internal Mailpit only; no real SMTP is configured.
- Removed Google Analytics scripts from the stage HTML. Private HTTPS remains under Nginx Basic Auth with noindex headers; no public MongoDB port exists.
- Distinct isolated stage MongoDB 8.0.30, upload directory and secrets. **Do not import raw personal/financial production data** without anonymizing it.

## First deploy prerequisites
1. On a **trusted local Ubuntu laptop**, authenticate `gh auth login`, clone the `staging` branch, and copy this reviewed source candidate into that checkout, then `git add` and push. Do not give this host a write-enabled GitHub deploy key.
2. In Hostinger stage VPS: prepare source in `/srv/iradios/staging/app` from your validated GitHub staging branch (via CI/CD or authenticated file transfer) and run `sudo bash ops/init-stage-secrets.sh` once.
3. Run `sudo bash ops/deploy-stage.sh` from checkout. This builds backend/frontend images locally; native Canvas install may need adjustment. Docker images are built on stage only, not live.
4. Once localhost health checks succeed, backup `/etc/nginx/sites-available/iradios-stage`, copy `ops/nginx-stage.conf` there, `sudo nginx -t` then reload. This retains the existing HTTPS cert and Basic Auth.
5. Verify: unauthenticated `curl -I https://stage.iradios.gr` returns 401, authenticated UI loads, `curl -u 'iluma:<your-pass>' https://stage.iradios.gr/api/health` is 200, Mailpit reachable at `/dev/mail/` behind auth.

### IMPORTANT validation blockers
- Check `npm install`/Vite build, missing public binary/static assets and the `canvas` native dependency. Source was reconstructed and full build has **not been run** here.
- Add tests for admin access control, SSRF, DB migrations, payment idempotency, audio streaming, widgets, mobile UI.
- Never start with the old Hetzner Docker Compose or copy the original live .env.
- Preserve and test off-server backups, including rollback. No prod promotion should be configured yet.

### Existing source caveats
- Some frontend flows expect real payment or captcha integrations and will remain disabled or reduced until adapted for stage test mode.
- Some radio logos may still reference production in **database documents**; code replacement does not rewrite the database.
- API authorization requires hardening independently of Nginx Basic Auth.
