#!/usr/bin/env bash
# One-time quarantine of imported STAGING email side effects in the isolated
# PRODUCTION copy. Does not delete mail audit rows or touch money/staging.
set -Eeuo pipefail
umask 077
APP=/srv/iradios/production/app
MODE="${1:---audit}"
[[ "$(id -u)" == 0 ]] || { echo "STOP: root required" >&2; exit 2; }
[[ "$MODE" == --audit || "$MODE" == --apply ]] || {
 echo "Usage: sudo bash ops/quarantine-prod-imported-emails.sh [--audit|--apply] [verified-backup-path]" >&2; exit 2;
}
[[ "$(git -c safe.directory="$APP" -C "$APP" branch --show-current)" == main ]] || {
 echo "STOP: expected main" >&2; exit 2;
}
[[ "$(docker inspect --format '{{.State.Health.Status}}' iradios_prod-mongo-1)" == healthy ]] || {
 echo "STOP: prod MongoDB unhealthy" >&2; exit 2;
}
if [[ "$MODE" == --apply ]]; then
 BACKUP="${2:-}"
 [[ -n "$BACKUP" && -d "$BACKUP" && ! -L "$BACKUP" ]] || {
  echo "STOP: --apply requires reviewed local prod backup directory" >&2; exit 2;
 }
 BACKUP=$(realpath -e "$BACKUP")
 [[ "$BACKUP" == /srv/iradios/production/backups/prod-before-verification-* ]] || {
  echo "STOP: Not a protected production backup" >&2; exit 2;
 }
 (cd "$BACKUP" && sha256sum --check --status SHA256SUMS) || {
  echo "STOP: Backup integrity check failed" >&2; exit 2;
 }
 if docker ps --format '{{.Names}}' | grep -Eq '^iradios_prod-(backend|frontend)-'; then
  echo "STOP: production application still running" >&2; exit 2;
 fi
 [[ ! -e /etc/iradios/production/data-verified ]] || {
  echo "STOP: production dataset already approved; refuse retrospective quarantine" >&2; exit 2;
 }
fi
echo "=== PRODUCTION-ONLY IMPORTED MAIL AUDIT ==="
docker exec -i -e "QUARANTINE_MODE=$MODE" iradios_prod-mongo-1 sh -ec '
 exec mongosh --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" \
   --authenticationDatabase admin
' <<'JS'
const d=db.getSiblingDB("iradios_prod");
const statuses=["pending","sending"];
const collections=[
  "billingemaildispatches",
  "broadcasterbillingemails",
  "advertisingcampaignmailevents"
];
for(const name of collections){
 const c=d.getCollection(name);
 const count=c.countDocuments({status:{$in:statuses}});
 print(name+" eligible="+count);
 if(process.env.QUARANTINE_MODE==="--apply" && count){
  const update=c.updateMany({status:{$in:statuses}},
   {$set:{status:"skipped",skipReason:"imported_staging_prelaunch_no_replay"}});
  if(update.modifiedCount!==count)throw Error("Concurrent mail status change: "+name);
  print(name+" quarantined="+update.modifiedCount);
 }
}
if(process.env.QUARANTINE_MODE==="--apply")
 print("PASS: Imported production-only pending financial emails quarantined. Sent audit retained.");
else print("READ ONLY: pass --apply with a verified production backup to quarantine.");
JS
