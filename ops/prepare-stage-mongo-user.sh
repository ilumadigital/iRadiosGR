#!/usr/bin/env bash
# Prepare least-privileged application account for the already-running stage MongoDB.
# Run on the Hostinger VPS as root, before deploying new compose.stage.yml.
set -euo pipefail
[[ "$(id -u)" == "0" ]] || { echo "Run as root"; exit 1; }
umask 077
ENVFILE=/etc/iradios/staging/compose.env
CONTAINER=iradios_stage-mongo-1
test -s "$ENVFILE" || { echo "Missing stage compose.env" >&2; exit 1; }
[[ "$(stat -c '%a' "$ENVFILE")" == "600" ]] || { echo "compose.env must be chmod 600" >&2; exit 1; }
[[ "$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER")" == "healthy" ]] || { echo "Mongo container is not healthy" >&2; exit 1; }
if ! grep -q '^STAGE_MONGO_APP_PASSWORD=' "$ENVFILE"; then
  echo "Adding separate app-only MongoDB credential (not displayed)."
  printf 'STAGE_MONGO_APP_PASSWORD=%s\n' "$(openssl rand -hex 32)" >> "$ENVFILE"
fi
APP_PASSWORD=$(sed -n 's/^STAGE_MONGO_APP_PASSWORD=//p' "$ENVFILE" | tail -n 1)
[[ "$APP_PASSWORD" =~ ^[[:xdigit:]]{64}$ ]] || { echo "Invalid stage app password format; stop" >&2; exit 1; }
# MongoDB account is scoped to iradios_stage; no admin/root or import-review access.
docker exec -i -e "IRADIOS_STAGE_MONGO_APP_PASSWORD=$APP_PASSWORD" "$CONTAINER" \
  sh -c 'exec mongosh --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' <<'JS'
const d = db.getSiblingDB("iradios_stage");
const name = "iradios_stage_app";
const secret = process.env.IRADIOS_STAGE_MONGO_APP_PASSWORD;
const roles = [{ role: "readWrite", db: "iradios_stage" }];
if (d.getUser(name)) {
  d.updateUser(name, { pwd: secret, roles });
} else {
  d.createUser({ user: name, pwd: secret, roles });
}
print("Stage-only MongoDB app user ready");
JS
# Validate correct auth without displaying credentials.
docker exec -e "IRADIOS_STAGE_MONGO_APP_PASSWORD=$APP_PASSWORD" "$CONTAINER" \
  sh -ec 'mongosh --quiet --username iradios_stage_app --password "$IRADIOS_STAGE_MONGO_APP_PASSWORD" --authenticationDatabase iradios_stage iradios_stage --eval "db.runCommand({ping:1}).ok" | grep -qx 1'
echo "Stage MongoDB app authentication OK"
