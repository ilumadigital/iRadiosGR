#!/usr/bin/env bash
# Stage-only Hostinger VPS GeoIP2 ingress: no Cloudflare DNS, proxy or API.
# Run ONLY after GeoLite2 City and geoip2 module have been installed manually.
# Preserves the existing site; never changes Gateway, Mailpit or billing flags.
set -Eeuo pipefail
umask 077

[[ "$(id -u)" == 0 ]] || { echo "STOP: run with sudo." >&2; exit 1; }
SITE=/etc/nginx/sites-available/iradios-stage
GEO=/etc/nginx/conf.d/iradios-stage-geoip2.conf
TRUST=/etc/nginx/conf.d/zz-iradios-stage-geoip2-trust.conf
BACKEND_ENV=/etc/iradios/staging/backend.env
APP=/srv/iradios/staging/app
BACKUP_DIR=/root/iradios-stage-backups

[[ -f "$SITE" && -s "$GEO" && -s /var/lib/GeoIP/GeoLite2-City.mmdb ]] || {
 echo "STOP: expected staging Nginx site or GeoLite2 database/config missing." >&2; exit 1;
}
[[ -s "$BACKEND_ENV" && "$(stat -c %a "$BACKEND_ENV")" == 600 ]] || {
 echo "STOP: private backend.env must exist with mode 600." >&2; exit 1;
}
grep -qx 'APP_ENV=staging' "$BACKEND_ENV" || { echo "STOP: staging only." >&2; exit 1; }
! grep -qx 'ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=1' "$BACKEND_ENV" || {
 echo "STOP: financial delivery must remain OFF during geo migration." >&2; exit 1;
}
[[ ! -e "$TRUST" && ! -L "$TRUST" ]] || {
 echo "STOP: trusted GeoIP2 map already exists; inspect before running again." >&2; exit 1;
}
if grep -q 'X-Iradios-Geo-Auth' "$SITE"; then
 echo "STOP: staging site already contains trusted geo headers; review manually." >&2; exit 1;
fi
nginx -t >/dev/null
# Any real-ip rewrite could make a visitor-supplied Forwarded header control
# $remote_addr. Confirm the *whole* loaded Nginx config, not just this site.
if nginx -T 2>/dev/null | awk '/^[[:space:]]*(real_ip_header|set_real_ip_from)[[:space:]]/{found=1} END{exit !found}'; then
 echo "STOP: real_ip rewriting configured; audit the upstream trust chain first." >&2; exit 1;
fi
if ! grep -Fq 'geoip2 /var/lib/GeoIP/GeoLite2-City.mmdb' "$GEO"; then
 echo "STOP: unexpected GeoIP2 database directive." >&2; exit 1;
fi
install -d -m 0700 "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/nginx-before-trusted-geo-$(date -u +%Y%m%d-%H%M%S)"
install -d -m 0700 "$BACKUP"
cp -a "$SITE" "$BACKUP/stage-site.conf"
cp -a "$GEO" "$BACKUP/geoip2.conf"
restore_on_error() {
 local result=$?
 trap - ERR
 if [[ "$result" != 0 ]]; then
  echo "STOP: GeoIP2 install failed; restoring Nginx config backups." >&2
  cp -a "$BACKUP/stage-site.conf" "$SITE"
  cp -a "$BACKUP/geoip2.conf" "$GEO"
  rm -f "$TRUST"
  if nginx -t; then systemctl reload nginx || true; fi
 fi
 exit "$result"
}
trap restore_on_error ERR

# Never source private ENV as shell, never print a secret and never accept
# arbitrary Nginx directives as an alleged key.
python3 - "$SITE" "$GEO" "$TRUST" "$BACKEND_ENV" <<'PY'
import os, pathlib, re, sys
site, geo, trust, env = map(pathlib.Path, sys.argv[1:])
rows = [line.strip() for line in env.read_text().splitlines()
        if line.startswith('IRADIOS_TRUSTED_GEO_SECRET=')]
if len(rows) != 1:
    raise RuntimeError('Expected exactly one trusted geo secret in backend.env')
secret = rows[0].split('=', 1)[1].strip()
if not re.fullmatch(r'[A-Za-z0-9_-]{32,256}', secret):
    raise RuntimeError('Geo secret must be 32-256 safe ASCII characters')
# Root-only Nginx HTTP map: ONLY valid country GeoIP2 lookup yields a token.
# Bad/missing geo never creates an authenticated visitor location.
auth_map = (
    '# Root-only iRadios staging GeoIP2 trust map. Never commit this file.\n'
    'map $iradios_geo_country $iradios_geo_auth_header {\n'
    '    default "";\n'
    '    GR "' + secret + '";\n'
    '    CY "' + secret + '";\n'
    '}\n'
)
fd = os.open(trust, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as f:
    f.write(auth_map)
os.chmod(trust, 0o600)

geo_text = geo.read_text()
if '$iradios_geo_accuracy_km' not in geo_text:
    anchor = '$iradios_geo_city source=$remote_addr city names en;'
    if geo_text.count(anchor) != 1:
        raise RuntimeError('GeoIP2 city variable not found exactly once')
    geo_text = geo_text.replace(anchor, anchor +
        '\n    $iradios_geo_accuracy_km source=$remote_addr location accuracy_radius;')
    geo.write_text(geo_text)

site_text = site.read_text()
if site_text.count('server_name stage.iradios.gr;') < 1:
    raise RuntimeError('Unexpected staging host')
lines = site_text.splitlines(keepends=True)
out, current, injected = [], '', 0
for line in lines:
    loc = re.match(r'^\s*location\s+(.+?)\s*\{\s*$', line.rstrip('\n'))
    if loc:
        current = loc.group(1).strip()
    out.append(line)
    if current and re.match(r'^\s*proxy_pass\s+http://127\.0\.0\.1:5511\s*;', line):
        prefix = re.match(r'^\s*', line).group(0)
        if current == '/api/':
            settings = [
                'proxy_set_header X-Iradios-Geo-Auth $iradios_geo_auth_header;',
                'proxy_set_header X-Iradios-Geo-Country $iradios_geo_country;',
                'proxy_set_header X-Iradios-Geo-Region $iradios_geo_region_name;',
                'proxy_set_header X-Iradios-Geo-City $iradios_geo_city;',
                'proxy_set_header X-Iradios-Geo-Accuracy-Km $iradios_geo_accuracy_km;',
                'proxy_set_header X-Iradios-Geo-Prefecture "";'
            ]
            injected += 1
        else:
            # Direct proxy-stream and socket routes cannot carry geo authority.
            settings = [
                'proxy_set_header X-Iradios-Geo-Auth "";',
                'proxy_set_header X-Iradios-Geo-Country "";',
                'proxy_set_header X-Iradios-Geo-Region "";',
                'proxy_set_header X-Iradios-Geo-City "";',
                'proxy_set_header X-Iradios-Geo-Accuracy-Km "";',
                'proxy_set_header X-Iradios-Geo-Prefecture "";'
            ]
        out.extend(prefix + setting + '\n' for setting in settings)
    if current and re.match(r'^\s*}\s*$', line):
        current = ''
if injected != 1:
    raise RuntimeError('Expected exactly one /api/ backend reverse-proxy location')
site.write_text(''.join(out))
PY

echo "=== VALIDATE STAGING NGINX ==="
nginx -t
echo "=== APPLY GEOIP2 INGRESS ==="
systemctl reload nginx
systemctl is-active --quiet nginx
curl -fsS --max-time 10 http://127.0.0.1:5511/api/health >/dev/null
trap - ERR
echo "GEOIP2_TRUST_INGRESS_INSTALLED"
echo "Root-only backup: $BACKUP"
echo "Keep ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=0 until paid delivery UAT."
