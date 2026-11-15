#!/usr/bin/env bash
# Explicit, one-time conversion of the EXISTING staging Mongo data volume to
# an authenticated single-node replica set. No volume deletion or data reset.
# Requires an independently VERIFIED backup and operator approval.
set -Eeuo pipefail
umask 077
[[ "$(id -u)" -eq 0 ]] || { echo 'Run with sudo on the stage VPS.' >&2; exit 1; }
[[ "${IRADIOS_STAGE_RS_MIGRATION_APPROVAL:-}" == I_VERIFIED_STAGING_BACKUP ]] || {
  echo 'STOP: verify an OFF-HOST staging Mongo backup, then set IRADIOS_STAGE_RS_MIGRATION_APPROVAL=I_VERIFIED_STAGING_BACKUP.' >&2
  exit 1
}
APP=/srv/iradios/staging/app
ENV=/etc/iradios/staging/compose.env
BACKEND_ENV=/etc/iradios/staging/backend.env
KEY=/etc/iradios/staging/mongo-replset.key
CONTAINER=iradios_stage-mongo-1
[[ -f "$APP/compose.stage.replicaset.yml" && -s "$ENV" && -s "$BACKEND_ENV" ]] || {
 echo 'STOP: stage checkout or private environment missing.' >&2; exit 1;
}
[[ "$(stat -c '%a' "$ENV")" == 600 && "$(stat -c '%a' "$BACKEND_ENV")" == 600 ]] || {
 echo 'STOP: private environment files must be chmod 600.' >&2; exit 1;
}
grep -qx 'APP_ENV=staging' "$BACKEND_ENV" || { echo 'STOP: staging only.' >&2; exit 1; }
if grep -qx 'ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED=1' "$BACKEND_ENV"; then
 echo 'STOP: turn OFF paid delivery before Mongo migration.' >&2; exit 1
fi
grep -qx 'STAGE_MONGO_RS_ENABLED=1' "$ENV" || {
 echo 'STOP: explicitly opt in with STAGE_MONGO_RS_ENABLED=1 in compose.env.' >&2; exit 1
}
[[ "$(docker inspect --format '{{.State.Running}}' "$CONTAINER")" == true ]] || {
 echo 'STOP: stage MongoDB is not running.' >&2; exit 1;
}
# The official image runs mongod as its own mongodb user, which must be able to
# read the 0400 keyfile; never embed the key in Git/Compose/env or logs.
if [[ -L "$KEY" ]]; then echo 'STOP: keyfile may not be a symlink.' >&2; exit 1; fi
if [[ ! -e "$KEY" ]]; then
 uid=$(docker exec "$CONTAINER" id -u mongodb)
 gid=$(docker exec "$CONTAINER" id -g mongodb)
 [[ "$uid" =~ ^[0-9]+$ && "$gid" =~ ^[0-9]+$ ]] || {
  echo 'STOP: cannot determine MongoDB keyfile owner.' >&2; exit 1;
 }
 install -m 0400 -o "$uid" -g "$gid" /dev/null "$KEY"
 openssl rand -base64 756 | tr -d '\n' > "$KEY"
 chmod 0400 "$KEY"
 echo 'Created stage-only MongoDB internal-auth keyfile (value hidden).'
fi
[[ "$(stat -c '%a' "$KEY")" == 400 && "$(wc -c < "$KEY")" -ge 32 ]] || {
 echo 'STOP: MongoDB keyfile permissions or length invalid.' >&2; exit 1;
}
cd "$APP"
docker compose --env-file "$ENV" -f compose.stage.yml -f compose.stage.replicaset.yml config --quiet
echo 'Recreating only the existing stage MongoDB container with replica-set security.'
docker compose --env-file "$ENV" -f compose.stage.yml -f compose.stage.replicaset.yml \
 up -d --no-deps mongo
ready=0
for i in $(seq 1 45); do
 if docker exec "$CONTAINER" sh -c \
  'mongosh --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "db.adminCommand({ping:1}).ok"' \
  2>/dev/null | grep -qx 1; then
   ready=1; break
 fi
 sleep 2
done
[[ "$ready" -eq 1 ]] || { echo 'STOP: stage MongoDB did not start. Do not deploy finance.' >&2; exit 1; }
docker exec -i "$CONTAINER" sh -c \
 'exec mongosh --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' <<'JS'
let existing=null;
try{existing=rs.conf();}catch(e){
 if(e.codeName!=='NotYetInitialized'&&e.code!==94)throw e;
}
if(existing){
 if(existing._id!=='rs0')throw Error('Unexpected existing replica-set name');
 print('Replica set already configured.');
}else{
 const result=rs.initiate({_id:'rs0',members:[{_id:0,host:'mongo:27017'}]});
 if(!result.ok)throw Error('Replica-set initialization failed');
 print('Stage replica set initialized.');
}
JS
primary=0
for i in $(seq 1 45); do
 if docker exec "$CONTAINER" sh -c \
  'mongosh --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "const s=db.adminCommand({hello:1});print(s.setName===\"rs0\"&&s.isWritablePrimary===true)"' \
  2>/dev/null | grep -qx true; then
   primary=1; break
 fi
 sleep 2
done
[[ "$primary" -eq 1 ]] || {
 echo 'STOP: no writable primary. Paid delivery MUST remain OFF.' >&2; exit 1;
}
echo 'Stage MongoDB is now an authenticated single-node replica-set primary.'
echo 'Keep paid delivery OFF until trusted geo ingress and campaign v2 funding are audited.'
echo 'Apply the replica-set backend URI with: cd /srv/iradios/staging/app && sudo ./ilumadev.sh'
