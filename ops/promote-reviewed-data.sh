#!/usr/bin/env bash
# Controlled one-time import of reviewed production snapshot into private iRadiosGR staging.
# Preserve orphan links (1 station owner, 20 analytics) exactly as provided.
# Run ONLY on the Hostinger stage as root AFTER security fixes have been deployed.
set -euo pipefail
[[ "$(id -u)" == "0" ]] || { echo "Run as root" >&2; exit 1; }
umask 077
APP=/srv/iradios/staging/app
BACKUPS=/srv/iradios/staging/backups
TRANSFER=$BACKUPS/transfer-20261107
COMPOSE_ENV=/etc/iradios/staging/compose.env
MONGO=iradios_stage-mongo-1
cd "$APP"
test -s "$TRANSFER/iradios-prod.archive.gz"
test -s "$TRANSFER/iradios-prod-uploads.tar.gz"
test -s "$BACKUPS/stage-preimport-20261107.archive.gz"
test -s "$COMPOSE_ENV"
grep -q 'iradios_stage_app:' compose.stage.yml || { echo "Missing Mongo app-role patch" >&2; exit 1; }
( cd "$TRANSFER" && sha256sum -c SHA256SUMS )
echo "Checking production upload paths..."
if tar -tzf "$TRANSFER/iradios-prod-uploads.tar.gz" | grep -Ev '^uploads(/|$)' ; then
  echo "STOP: non-uploads paths in archive" >&2; exit 1
fi
if tar -tzf "$TRANSFER/iradios-prod-uploads.tar.gz" | grep -E '(^/|(^|/)\.\.(/|$))' ; then
  echo "STOP: traversal path in archive" >&2; exit 1
fi
if tar -tzvf "$TRANSFER/iradios-prod-uploads.tar.gz" | grep '^l' >/dev/null; then
  echo "STOP: symlink in uploads archive; manual review needed" >&2; exit 1
fi
[[ "$(docker inspect --format '{{.State.Health.Status}}' "$MONGO")" == "healthy" ]] || { echo "MongoDB not healthy" >&2; exit 1; }
echo "Checking review and destination counts (no personal data output)..."
docker exec -i "$MONGO" sh -c 'exec mongosh --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' <<'JS'
const review=db.getSiblingDB("iradios_import_review"), stage=db.getSiblingDB("iradios_stage");
const expected={users:240,stations:68,subscriptions:96,stationanalytics:88,emailhistories:17,transactions:5,ads:4,bannerads:2,chatmessages:0};
let r=0,s=0;
for(const [name,n] of Object.entries(expected)){
 const x=review.getCollection(name).countDocuments({}),y=stage.getCollection(name).countDocuments({});
 if(x!==n || y!==0) throw new Error("Unexpected counts in "+name+": review "+x+" / stage "+y);
 r+=x;s+=y;
}
if(r!==520||s!==0)throw new Error("Snapshot counts failed");
print("Review 520/520, stage 0/520: OK");
JS
echo "Backing up original staging uploads..."
tar -C /srv/iradios/staging -czf "$BACKUPS/stage-uploads-preimport-20261107.tar.gz" uploads
echo "Temporarily stopping stage frontend and backend (production is untouched)..."
docker compose --env-file "$COMPOSE_ENV" -f compose.stage.yml stop frontend backend
echo "Importing 9.0 review data into the indexed stage collections..."
docker exec "$MONGO" bash -euo pipefail -c '
  mongodump --username root --password "$MONGO_INITDB_ROOT_PASSWORD" \
    --authenticationDatabase admin --db iradios_import_review --archive --gzip |
  mongorestore --username root --password "$MONGO_INITDB_ROOT_PASSWORD" \
    --authenticationDatabase admin --archive --gzip --stopOnError \
    --noIndexRestore --noOptionsRestore \
    --nsInclude "iradios_import_review.*" \
    --nsFrom "iradios_import_review.*" \
    --nsTo "iradios_stage.*"
'
echo "Neutralizing production-only reset tokens, push endpoints and payment identifiers IN STAGE ONLY..."
docker exec -i "$MONGO" sh -c 'exec mongosh --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' <<'JS'
const d=db.getSiblingDB("iradios_stage");
const expected={users:240,stations:68,subscriptions:96,stationanalytics:88,emailhistories:17,transactions:5,ads:4,bannerads:2,chatmessages:0};
for(const [name,n] of Object.entries(expected))
 if(d.getCollection(name).countDocuments({})!==n)throw new Error("Import count mismatch: "+name);
d.users.updateMany({},{
  $set:{verificationOtp:null,otpExpires:null,resetPasswordToken:null,resetPasswordExpires:null,
        stripeCustomerId:null,stripeSubscriptionId:null},
  $unset:{pushSubscription:""}
});
d.users.updateMany({activeSubscriptions:{$type:"array"}},{
  $set:{"activeSubscriptions.$[].stripeSubscriptionId":null}
});
d.subscriptions.updateMany({},[{$set:{
 endpoint:{$concat:["https://invalid.example/iradios-stage-disabled/",{$toString:"$_id"}]},
 keys:{$literal:{}}, expirationTime:null
}}]);
d.transactions.updateMany({},[{$set:{
 stripeSessionId:{$concat:["stage-disabled-",{$toString:"$_id"}]},
 stripePaymentIntentId:null
}}]);
print("Staging-only ephemeral credentials and live payment IDs neutralized.");
let sum=0;
for(const [name,n] of Object.entries(expected)){
 const actual=d.getCollection(name).countDocuments({});
 if(actual!==n)throw new Error("After-sanitize count mismatch: "+name);
 sum+=actual;
}
print("STAGE DOCUMENTS: "+sum+"/520");
JS
echo "Restoring production media to stage-only uploads directory..."
tar --extract --gzip --file "$TRANSFER/iradios-prod-uploads.tar.gz" \
  --directory /srv/iradios/staging --no-same-owner --no-same-permissions
chown -R iradios:iradios /srv/iradios/staging/uploads
echo "Starting stage frontend/backend with restricted MongoDB account..."
docker compose --env-file "$COMPOSE_ENV" -f compose.stage.yml up -d backend frontend
curl -fsS http://127.0.0.1:5511/api/health
curl -fsS http://127.0.0.1:5510/ >/dev/null
echo "STAGING IMPORT COMPLETED. Original review DB and source archives remain unchanged."
