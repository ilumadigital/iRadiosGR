#!/usr/bin/env bash
# Zero-test-paid-entitlement preflight for an isolated iRadios production candidate.
# READ ONLY. Imported staging payment history must never become paid rights.
set -Eeuo pipefail
umask 077
APP=/srv/iradios/production/app
[[ "$(id -u)" == 0 ]] || { echo "STOP: run with sudo" >&2; exit 2; }
[[ -d "$APP/.git" ]] || { echo "STOP: missing production checkout" >&2; exit 2; }
branch=$(git -c safe.directory="$APP" -C "$APP" branch --show-current)
[[ "$branch" == main ]] || { echo "STOP: expected production main, found $branch" >&2; exit 2; }
[[ "$(docker inspect --format '{{.State.Health.Status}}' iradios_prod-mongo-1)" == healthy ]] || {
 echo "STOP: production MongoDB is not healthy" >&2; exit 2;
}
python3 "$APP/ops/check-prod-env.py" /etc/iradios/production/backend.env /etc/iradios/production/compose.env

echo "=== IRADIOS PRODUCTION CLEAN-LAUNCH ENTITLEMENTS ==="
# Do not inspect personal details or print document IDs/provider references.
docker exec -i iradios_prod-mongo-1 sh -ec '
 script=$(cat)
 exec mongosh --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" \
   --authenticationDatabase admin --eval "$script"
' <<'JS'
const d=db.getSiblingDB("iradios_prod");
const now=new Date();
const count=(name,filter)=>d.getCollection(name).countDocuments(filter);
const checks={
  production_listener_orders:count("billingorders",{environment:"production"}),
  production_broadcaster_orders:count("broadcasterbillingorders",{environment:"production"}),
  production_paid_funding_lots:count("advertisingfundinglots",{environment:"production",source:"nexi_verified"}),
  production_admin_grants:count("billinggrants",{environment:"production",source:"admin_complimentary",revokedAt:null,
    startsAt:{$lte:now},$or:[{expiresAt:null},{expiresAt:{$gt:now}}]}),
  staging_listener_history:count("billingorders",{environment:"staging"}),
  staging_broadcaster_history:count("broadcasterbillingorders",{environment:"staging"}),
  staging_funding_history:count("advertisingfundinglots",{environment:"staging"}),
  pending_listener_emails:count("billingemaildispatches",{status:{$in:["pending","sending"]}}),
  pending_broadcaster_emails:count("broadcasterbillingemails",{status:{$in:["pending","sending"]}}),
  pending_campaign_emails:count("advertisingcampaignmailevents",{status:{$in:["pending","sending"]}})
};
for(const [key,value] of Object.entries(checks))print(key+"="+value);
const requiredZero=[
  "production_listener_orders","production_broadcaster_orders",
  "production_paid_funding_lots","pending_listener_emails",
  "pending_broadcaster_emails","pending_campaign_emails"
];
const blockers=requiredZero.filter(k=>checks[k]!==0);
if(blockers.length){
  print("STOP: nonempty production paid scope or imported pending email side effects: "+blockers.join(","));
  print("Preserve audit records. Review and quarantine legacy side effects before enabling live billing.");
  quit(1);
}
print("PASS: no production-scope paid orders or funding and no pending imported financial emails");
print("NOTE: Admin grants are separately counted; provider Nexi and Gateway readiness are NOT proven.");
JS
