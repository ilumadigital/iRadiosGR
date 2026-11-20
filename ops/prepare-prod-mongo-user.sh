#!/usr/bin/env bash
# Provision a least-privilege user only within the separate production MongoDB.
set -Eeuo pipefail
umask 077
[[ "$(id -u)" == 0 ]] || { echo "Run with sudo" >&2; exit 1; }
ENV=/etc/iradios/production/compose.env
CONTAINER=iradios_prod-mongo-1
[[ -s "$ENV" ]] || { echo "STOP: missing production compose env" >&2; exit 1; }
[[ "$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER")" == healthy ]] || {
 echo "STOP: production MongoDB not healthy" >&2; exit 1;
}
PASSWORD=$(sed -n 's/^PROD_MONGO_APP_PASSWORD=//p' "$ENV" | tail -n 1)
[[ "$PASSWORD" =~ ^[a-fA-F0-9]{64}$ ]] || { echo "STOP: PROD_MONGO_APP_PASSWORD must be a 64-char hex secret" >&2; exit 1; }
docker exec -i -e "IRADIOS_PROD_MONGO_APP_PASSWORD=$PASSWORD" "$CONTAINER" \
 sh -c 'exec mongosh --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' <<'JS'
const d=db.getSiblingDB("iradios_prod");
const name="iradios_prod_app";
const secret=process.env.IRADIOS_PROD_MONGO_APP_PASSWORD;
if(d.getUser(name)) {
 print("Production app user already exists; no credential change");
} else {
 d.createUser({user:name,pwd:secret,roles:[{role:"readWrite",db:"iradios_prod"}]});
 print("Production app user created");
}
JS
docker exec -e "IRADIOS_PROD_MONGO_APP_PASSWORD=$PASSWORD" "$CONTAINER" \
 sh -ec 'mongosh --quiet --username iradios_prod_app --password "$IRADIOS_PROD_MONGO_APP_PASSWORD" --authenticationDatabase iradios_prod iradios_prod --eval "db.runCommand({ping:1}).ok" | grep -qx 1'
echo "PASS: production-only app credentials (no stage access)"
