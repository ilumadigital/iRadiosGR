# iRadiosGR — Hostinger VPS trusted GeoIP2 activation (staging only)
Updated 2026-11-15. **No Cloudflare proxy, DNS migration or Turnstile change.**

## Verified operator prerequisites
- Hostinger DNS points `stage.iradios.gr` directly at staging Nginx.
- Ubuntu 26.04, Nginx 1.28.3, `libnginx-mod-http-geoip2` loaded.
- Root-only MaxMind license lives only in `/etc/GeoIP.conf` (mode 0600).
- `/var/lib/GeoIP/GeoLite2-City.mmdb` exists and is readable by Nginx; `geoipupdate.timer` active.
- Operator already created `/etc/nginx/conf.d/iradios-stage-geoip2.conf` with:
  ```nginx
  geoip2 /var/lib/GeoIP/GeoLite2-City.mmdb {
      auto_reload 5m;
      $iradios_geo_country source=$remote_addr country iso_code;
      $iradios_geo_region_code source=$remote_addr subdivisions 0 iso_code;
      $iradios_geo_region_name source=$remote_addr subdivisions 0 names en;
      $iradios_geo_city source=$remote_addr city names en;
  }
  ```
- Backend secret `IRADIOS_TRUSTED_GEO_SECRET` is set to a unique private ASCII token >=32 characters in `/etc/iradios/staging/backend.env` (mode 0600).
- MongoDB `rs0` writable primary and `mongoReplicaSetReady:true` confirmed.
- Keep `ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=0` and `APP_ENV=staging`.
- Check `nginx -T` for `real_ip_header` or `set_real_ip_from`. The installer **refuses** to proceed if either is present; CDN/proxy hops must be separately audited.

## Merge and manual staging rollout
1. Review the new PR, its tests, and check against the separate draft commercial-readiness PR #135. This PR **branches from the deployed staging branch** and does not require PR #135 to install.
2. Merge reviewed GeoIP2 PR into `staging`. Git push alone does not deploy to VPS.
3. On the VPS:
   ```bash
   cd /srv/iradios/staging/app
   sudo ./ilumadev.sh
   ```
   Verify the backend passes health checks and v2 finance still reads `configured:false`.
4. Run the root-only GeoIP2 trust installer:
   ```bash
   cd /srv/iradios/staging/app
   sudo bash ops/install-stage-geoip2-trust.sh
   ```
   The script:
   - refuses non-staging or enabled paid delivery;
   - requires the direct Nginx TCP IP (no trusted forwarded visitor IP);
   - backs up the *actual* staging Nginx site and GeoIP2 HTTP config under `/root/iradios-stage-backups/`;
   - inserts `location accuracy_radius` for conservative city->prefecture inference;
   - makes a root-only 0600 Nginx map with the **existing** backend secret, selected only for MaxMind `GR`/`CY`;
   - **overwrites** all `X-Iradios-Geo-*` headers for the standard `/api/` upstream with GeoIP2 outputs and an origin-only token;
   - forces empty geo headers on direct alternative backend upstreams (e.g. `/api/proxy-stream`, `/api/connect.io`);
   - validates `nginx -t`, reloads, checks backend health; restores original files on failure.
5. Do not paste `sudo nginx -T` output, `/etc/GeoIP.conf`, the generated root-only trust map or any ENV value into chat.

## Safe live checks — leave financial delivery OFF
From a **real visitor's Greek broadband/mobile connection**, not the VPS shell:
```bash
curl -fsS https://stage.iradios.gr/api/advertising/v2/status \
 | python3 -c 'import json,sys; d=json.load(sys.stdin); print({k:d.get(k) for k in ("mongoReplicaSetReady","geoPrecision","trustedGeoReady","configured","enabled")})'
```
Expected with a recognized Greek region: `trustedGeoReady:true`, `geoPrecision:region` or `prefecture`, `configured:false`, `enabled:false`.
`geoPrecision:country` is possible when MaxMind lacks region or the region is not mapped; **not adequate for prefecture-only delivery**.
The request from the VPS to its own domain geolocates the **server IP** (possibly outside GR/CY), not the user's browser, and can correctly return `trustedGeoReady:false`.

Header-forgery check from same client:
```bash
curl -fsS -H 'X-Iradios-Geo-Auth: forged' \
  -H 'X-Iradios-Geo-Country: CY' \
  -H 'X-Iradios-Geo-Region: Nicosia' \
  -H 'X-Iradios-Geo-Prefecture: Λευκωσία' \
  https://stage.iradios.gr/api/advertising/v2/status
```
Readiness and `geoPrecision` must be **identical** to the same request without forged headers. A forged request must NEVER change a visitor's trusted geo.

`curl -I` on a page does **not** prove correct geo; ticket / financial QA is a later, separate phase. Inspect campaign region matching on physically diverse authorized client networks before charging. No deliberate VPN-spoofed target should qualify without its IP address actually belonging to that target as evaluated by the local DB.

## Operational caveats
- GeoLite2 City provides estimated IP location, not GPS or a verified physical address. MaxMind warns its free database is **not suitable for commercial-grade applications**; assess a paid GeoIP dataset and error rates before production billing/geotargeting.
- `trustedGeoReady:true` means a signed server-origin GeoIP result, **not** proof of prefecture precision or accuracy. The backend returns `geoPrecision`, and drops unknown regions down to `country`.
- City-to-prefecture resolution is only permitted for known catalog cities with a MaxMind accuracy radius of 1–25 km; ambiguous or coarser results are not targeted to a prefecture. Attica's sole catalog prefecture can follow from known Attica region.
- No Nginx/Caddy/Traefik/IP-inference fallback; Cloudflare Turnstile remains only on auth forms.
- The installer intentionally refuses a second invocation; never overwrite its generated private file blindly.
- Real financial delivery, sandbox funding tests, ledger debits, refunds and subscriptions remain separate UAT gates.

## Rollback
Keep the original backup directory path printed by the installer. In case of unexpected geo behavior:
```bash
# Root on VPS: enter the exact root-only backup DIRECTORY printed by installer.
# Do not copy an example path blindly.
BACKUP_DIR=/root/iradios-stage-backups/nginx-before-trusted-geo-YYYYMMDD-HHMMSS
sudo cp -a "$BACKUP_DIR/stage-site.conf" /etc/nginx/sites-available/iradios-stage
sudo cp -a "$BACKUP_DIR/geoip2.conf" /etc/nginx/conf.d/iradios-stage-geoip2.conf
sudo rm -f /etc/nginx/conf.d/zz-iradios-stage-geoip2-trust.conf
sudo nginx -t && sudo systemctl reload nginx
```
Do not delete MongoDB volumes, change Gateway mode or adjust the financial delivery flag during this rollback.
