#!/usr/bin/env bash
# Read-only snapshot of STAGING MongoDB and uploads. Never mutates MongoDB.
set -Eeuo pipefail
umask 077
[[ "$(id -u)" == 0 ]] || { echo "Run as root" >&2; exit 1; }
for cmd in docker tar sha256sum gzip date; do command -v "$cmd" >/dev/null || exit 1; done
STAGE=/srv/iradios/staging/app
ENV=/etc/iradios/staging/compose.env
BACKUPS=/srv/iradios/production/backups
[[ -s "$ENV" && -d /srv/iradios/staging/uploads ]] || { echo "STOP: missing stage credentials/uploads" >&2; exit 1; }
[[ "$(docker inspect --format '{{.State.Health.Status}}' iradios_stage-mongo-1)" == healthy ]] || {
  echo "STOP: stage MongoDB unhealthy" >&2; exit 1;
}
mkdir -p -m 0700 "$BACKUPS"
dest="$BACKUPS/staging-snapshot-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -m 0700 "$dest"
cd "$STAGE"
printf 'INCOMPLETE\n' > "$dest/STATE"
# Mongo standalone exports may be inconsistent if writers run. An initial
# snapshot is for QA only; take the FINAL snapshot after write freeze.
docker compose --env-file "$ENV" -f compose.stage.yml exec -T mongo \
 sh -ec 'exec mongodump --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db iradios_stage --archive --gzip' \
 > "$dest/mongo.archive.gz"
tar -C /srv/iradios/staging -czf "$dest/uploads.tar.gz" uploads
gzip -t "$dest/mongo.archive.gz"
gzip -t "$dest/uploads.tar.gz"
(cd "$dest" && sha256sum mongo.archive.gz uploads.tar.gz > SHA256SUMS)
printf 'SNAPSHOT_OK\n' > "$dest/STATE"
echo "PASS: Staging snapshot captured at $dest (contains sensitive user data; root-only)"
echo "NOTE: Repeat under write freeze for the final cutover snapshot."
