#!/usr/bin/env bash
# Start only the independent production MongoDB with rs0, never staging or backend.
set -Eeuo pipefail
umask 077
[[ "$(id -u)" == 0 ]] || { echo "STOP: sudo required" >&2; exit 1; }
APP=/srv/iradios/production/app
ROOT=/etc/iradios/production
ENV="$ROOT/compose.env"
KEY="$ROOT/mongo-replset.key"
cd "$APP"
[[ -s "$ENV" && -f "$ROOT/backend.env" && -s "$KEY" ]] || { echo "STOP: run init-prod-mongo-secrets.sh first" >&2; exit 1; }
[[ ! -L "$KEY" && "$(stat -c %a "$ENV")" == 600 && "$(stat -c %a "$KEY")" == 400 ]] || {
 echo "STOP: unsafe production Mongo credentials or keyfile permissions" >&2; exit 1;
}
grep -Eq '^PROD_MONGO_PASSWORD=[a-f0-9]{64}$' "$ENV" || { echo "STOP: invalid Mongo root credential format" >&2; exit 1; }
grep -Eq '^PROD_MONGO_APP_PASSWORD=[a-f0-9]{64}$' "$ENV" || { echo "STOP: invalid Mongo app credential format" >&2; exit 1; }
[[ ! -e /etc/iradios/production/data-verified ]] || {
 echo "STOP: data-verified flag exists; starting an empty DB is not appropriate" >&2; exit 1;
}
compose=(docker compose --env-file "$ENV" -f compose.prod.yml -f compose.prod.replicaset.yml)
"${compose[@]}" config --quiet
# Do NOT start backend/frontend; production must stay inaccessible until reconciliation.
"${compose[@]}" up -d --no-deps --wait mongo
docker exec -i iradios_prod-mongo-1 sh -c \
 'exec mongosh --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --directConnection' <<'JS'
let existing=null;
try { existing=rs.conf(); } catch(e) {
 if(e.codeName!=='NotYetInitialized'&&e.code!==94)throw e;
}
if(existing) {
 if(existing._id!=='rs0' || existing.members.length!==1 || existing.members[0].host!=='mongo:27017')
   throw Error('Unexpected existing production replica-set configuration');
 print('Production rs0 already configured');
} else {
 const response=rs.initiate({_id:'rs0',members:[{_id:0,host:'mongo:27017'}]});
 if(!response.ok)throw Error('rs.initiate failed');
 print('Production rs0 initialized');
}
JS
primary=0
for attempt in $(seq 1 35); do
 if docker exec iradios_prod-mongo-1 sh -ec \
  'mongosh --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --directConnection --eval "const v=db.adminCommand({hello:1});print(v.setName===\"rs0\" && v.isWritablePrimary===true)"' \
  2>/dev/null | grep -qx true; then primary=1; break; fi
 sleep 2
done
[[ "$primary" == 1 ]] || { echo "STOP: production replica set did not elect PRIMARY"; exit 1; }
echo "PASS: independent production MongoDB is a healthy rs0 PRIMARY."
echo "No staging or Gateway container changed, no production backend started."
