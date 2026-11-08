#!/usr/bin/env bash
# Read-only, zero-credit SonoVault staging configuration check.
set -Eeuo pipefail
APP=/srv/iradios/staging/app
BACKEND_ENV=/etc/iradios/staging/backend.env
COMPOSE_ENV=/etc/iradios/staging/compose.env

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash ops/check-stage-sonovault-runtime.sh" >&2
  exit 1
fi
[[ -f "$BACKEND_ENV" && -f "$COMPOSE_ENV" && -f "$APP/compose.stage.yml" ]] || {
  echo "STOP: staging configuration files missing." >&2
  exit 1
}
echo "Checking backend.env keys (never printing secret values):"
for name in APP_ENV STAGE_ENABLE_SONOVAULT SONOVAULT_API_KEY; do
  awk -v key="$name" -F= '
    $1==key {
      count++
      if(length($2)>0) set++
      if(key=="APP_ENV" && $2=="staging") valid++
      if(key=="STAGE_ENABLE_SONOVAULT" && $2=="1") valid++
    }
    END {
      if(count!=1 || set!=1) {print key ": MISSING/EMPTY/DUPLICATE";exit 2}
      if(key!="SONOVAULT_API_KEY" && valid!=1) {print key ": OFF/INVALID";exit 2}
      print key ": OK"
    }' "$BACKEND_ENV" || exit 2
done
echo "Checking runtime in staging backend container:"
docker compose --env-file "$COMPOSE_ENV" -f "$APP/compose.stage.yml" exec -T backend node -e '
const e=process.env;
const ready=e.APP_ENV==="staging" && e.STAGE_ENABLE_SONOVAULT==="1" && Boolean(e.SONOVAULT_API_KEY?.trim());
console.log("Runtime stage:",e.APP_ENV==="staging"?"OK":"INVALID");
console.log("Manual SonoVault:",e.STAGE_ENABLE_SONOVAULT==="1"?"ON":"OFF");
console.log("API key:",e.SONOVAULT_API_KEY?.trim()?"PRESENT":"MISSING");
console.log("Automatic recognition: DISABLED IN CODE");
console.log("Status:",ready?"READY TO TEST":"NOT READY");
process.exit(ready?0:2);
'
echo "Configuration check complete. No billable recognition request made."
