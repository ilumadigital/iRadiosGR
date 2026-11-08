#!/usr/bin/env bash
# Read-only ACRCloud diagnostics for Hostinger STAGING. Never print secret values.
set -Eeuo pipefail
APP=/srv/iradios/staging/app
BACKEND_ENV=/etc/iradios/staging/backend.env
COMPOSE_ENV=/etc/iradios/staging/compose.env

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash ops/check-stage-acrcloud-runtime.sh" >&2
  exit 1
fi
[[ -f "$BACKEND_ENV" && -f "$COMPOSE_ENV" && -f "$APP/compose.stage.yml" ]] || {
  echo "STOP: staging files missing." >&2
  exit 1
}

echo "Checking server-side settings (NO secret values displayed):"
for name in APP_ENV ACRCLOUD_HOST ACRCLOUD_ACCESS_KEY ACRCLOUD_ACCESS_SECRET STAGE_ENABLE_ACRCLOUD; do
  awk -v name="$name" -F= '
    $1==name {
      count++
      if (length($2)>0) set++
      if (name=="STAGE_ENABLE_ACRCLOUD" && $2=="1") enabled++
      if (name=="APP_ENV" && $2=="staging") stage++
    }
    END {
      if (count!=1 || set!=1) {print name ": MISSING/EMPTY/DUPLICATE"; exit 2}
      if (name=="STAGE_ENABLE_ACRCLOUD" && enabled!=1) {print name ": OFF"; exit 2}
      if (name=="APP_ENV" && stage!=1) {print name ": INVALID"; exit 2}
      print name ": OK"
    }' "$BACKEND_ENV" || exit 2
done

echo "Checking settings actually loaded in the backend container:"
docker compose --env-file "$COMPOSE_ENV" -f "$APP/compose.stage.yml" exec -T backend node -e '
const e=process.env;
const host=typeof e.ACRCLOUD_HOST==="string"&&/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.acrcloud\.com$/i.test(e.ACRCLOUD_HOST);
const ready=e.APP_ENV==="staging" && e.STAGE_ENABLE_ACRCLOUD==="1" && host &&
  Boolean(e.ACRCLOUD_ACCESS_KEY) && Boolean(e.ACRCLOUD_ACCESS_SECRET);
console.log("Runtime stage environment:",e.APP_ENV==="staging"?"OK":"INVALID");
console.log("Runtime ACRCloud switch:",e.STAGE_ENABLE_ACRCLOUD==="1"?"ON":"OFF");
console.log("Runtime ACRCloud host:",host?"VALID":"INVALID");
console.log("Runtime credentials:",e.ACRCLOUD_ACCESS_KEY&&e.ACRCLOUD_ACCESS_SECRET?"PRESENT":"MISSING");
const auto=e.STAGE_ENABLE_AUTO_ACRCLOUD==="1";
const budget=Number(e.STAGE_AUTO_ACR_DAILY_LIMIT);
console.log("Runtime automatic category Top-5 recognition:",auto?"ON":"OFF");
console.log("Runtime daily auto recognition cap:",Number.isInteger(budget)&&budget>=0?Math.min(budget,2880):2880);
if(auto&&!ready)console.log("WARNING: Auto recognition is ON but ACRCloud is not configured.");

console.log("Status:",ready?"READY TO TEST":"NOT READY");
process.exit(ready?0:2);
'
echo "Settings ready. This check makes NO paid ACRCloud API calls."
