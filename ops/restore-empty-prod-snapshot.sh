#!/usr/bin/env bash
# Restore a verified staging snapshot into an EMPTY, independent production DB.
# No drop, delete, volume reset or stage writes. Use only on a reviewed candidate.
set -Eeuo pipefail
umask 077
[[ "$(id -u)" == 0 && "$#" == 1 ]] || {
 echo "Usage: sudo bash ops/restore-empty-prod-snapshot.sh /srv/iradios/production/backups/staging-snapshot-YYYYMMDDTHHMMSSZ" >&2; exit 2;
}
for cmd in realpath docker sha256sum tar; do command -v "$cmd" >/dev/null || exit 1; done
candidate=$(realpath -e -- "$1")
[[ "$candidate" == /srv/iradios/production/backups/staging-snapshot-* ]] || {
  echo "STOP: snapshot must be under protected production backups" >&2; exit 1;
}
[[ "$(cat "$candidate/STATE")" == SNAPSHOT_OK ]] || { echo "STOP: incomplete snapshot"; exit 1; }
(cd "$candidate" && sha256sum --check --status SHA256SUMS) || { echo "STOP: snapshot checksum mismatch"; exit 1; }
[[ -s /etc/iradios/production/compose.env ]] || { echo "STOP: no production compose secrets"; exit 1; }
[[ "$(docker inspect --format '{{.State.Health.Status}}' iradios_prod-mongo-1)" == healthy ]] || {
 echo "STOP: production MongoDB must already exist and be healthy" >&2; exit 1;
}
if docker ps --format '{{.Names}}' | grep -Eq '^iradios_prod-(backend|frontend)-'; then
 echo "STOP: production app is already running; refuse restore" >&2; exit 1;
fi
cd /srv/iradios/production/app
env=/etc/iradios/production/compose.env
compose=(docker compose --env-file "$env" -f compose.prod.yml -f compose.prod.replicaset.yml)
count=$("${compose[@]}" exec -T mongo sh -ec \
 'mongosh --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "print(db.getSiblingDB(\"iradios_prod\").getCollectionNames().length)"' | tail -n 1)
[[ "$count" == 0 ]] || { echo "STOP: production DB already has collections; never overwrite"; exit 1; }
mkdir -p -m 0750 /srv/iradios/production/uploads
[[ -z "$(find /srv/iradios/production/uploads -mindepth 1 -print -quit)" ]] || {
 echo "STOP: production uploads directory not empty"; exit 1;
}
# --stopOnError + no --drop; archive source namespace is mapped to new DB.
cat "$candidate/mongo.archive.gz" | "${compose[@]}" exec -T mongo sh -ec \
 'exec mongorestore --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --stopOnError --nsFrom="iradios_stage.*" --nsTo="iradios_prod.*"'
tar -C /srv/iradios/production -xzf "$candidate/uploads.tar.gz"
echo "PASS: initial data restored to independent production candidate."
echo "STOP: DO NOT CREATE data-verified yet. Audit users, stations, assets,"
echo "      Gateway live payments and source consistency. Final write-freeze sync remains pending."
