# iRadiosGR · Production → Staging database copy (2026-11-07)

## Scope and safety
- Source: Hetzner production MongoDB **4.4**, container `iradios-mongodb`. Target: Hostinger stage MongoDB **9.0.4**, network `iradios_stage_internal`.
- Export **only the application database**, assumed `iradios` once verified, plus `/var/www/iradios-app/uploads`. Do not export the `admin`/`local` databases or production service configuration, JWT, SMTP, Stripe, or Mongo server credentials.
- User account password fields are bcrypt **hashes**, not plaintext passwords; these come with the users collection and do not need exporting separately.
- **Never** run `mongorestore` against Hetzner, and never run `docker compose down -v`. Neither archive nor uploads should be committed to GitHub, emailed, or pasted into ChatGPT.
- MongoDB documentation guarantees raw BSON documents into same or newer MongoDB versions, but **not** metadata, indexes, or archive/oplog replay across this version gap. Keep the full original dump; the trial restore below deliberately skips old options and indexes, which need separate review.
- If production is a standalone MongoDB, `mongodump` without `--oplog` is not point-in-time consistent during concurrent writes. Run during a low-traffic/write-quiescent window. A definitive no-data-loss production migration needs a separately coordinated approach.

## A. Preflight on Hetzner (root SSH; read-only)
```bash
docker inspect iradios-mongodb --format '{{.Config.Image}}'
docker exec iradios-mongodb mongo --quiet --eval 'db.adminCommand({listDatabases:1}).databases.forEach(x=>print(x.name+" "+x.sizeOnDisk))'
docker exec iradios-mongodb mongodump --version
df -h /root
du -sh /var/www/iradios-app/uploads
```
Confirm the application DB name is exactly `iradios`. If an auth error appears, stop: arrange credentials securely without placing them in chat or shell history. Check available disk space for a full export.

## B. Read-only export from production (Hetzner)
```bash
set -euo pipefail
umask 077
BACKUP=/root/iradios-stage-transfer-20261107
test ! -e "$BACKUP" || { echo "Backup directory already exists; stop."; exit 1; }
install -d -m 700 "$BACKUP"
docker run --rm --network container:iradios-mongodb \
  -v "$BACKUP:/backup" mongo:4.4 \
  mongodump --host 127.0.0.1 --port 27017 \
  --db iradios --numParallelCollections 2 --gzip --out /backup/dump
test -d "$BACKUP/dump/iradios" || { echo "Missing app DB dump"; exit 1; }
tar -C "$BACKUP" -cf "$BACKUP/iradios-prod-bson.tar" dump
tar -C /var/www/iradios-app -czf "$BACKUP/iradios-prod-uploads.tar.gz" uploads
( cd "$BACKUP"; sha256sum iradios-prod-bson.tar iradios-prod-uploads.tar.gz > SHA256SUMS )
ls -lh "$BACKUP"/iradios-prod* "$BACKUP"/SHA256SUMS
```
These commands read production databases and files. Production keeps operating. Never delete the prod backup before verifying the stage copy.

## C. Transfer over SSH (on the trusted Ubuntu laptop)
```bash
mkdir -p ~/iradios-private-transfer
chmod 700 ~/iradios-private-transfer
scp root@HETZNER_HOST:/root/iradios-stage-transfer-20261107/iradios-prod-bson.tar ~/iradios-private-transfer/
scp root@HETZNER_HOST:/root/iradios-stage-transfer-20261107/iradios-prod-uploads.tar.gz ~/iradios-private-transfer/
scp root@HETZNER_HOST:/root/iradios-stage-transfer-20261107/SHA256SUMS ~/iradios-private-transfer/
scp ~/iradios-private-transfer/{iradios-prod-bson.tar,iradios-prod-uploads.tar.gz,SHA256SUMS} root@185.230.64.89:/srv/iradios/staging/backups/
```
Replace `HETZNER_HOST` with the known production SSH hostname/IP, **not** a MongoDB TCP port. Files contain sensitive user data; delete laptop copies securely after approved backup retention.

## D. Stage: verify transfer, take a local baseline backup, import into a non-live review DB
First pull the staged scheduler safety fix and rebuild backend:
```bash
cd /srv/iradios/staging/app
sudo -u iradios git pull --ff-only origin staging
sudo bash ops/deploy-stage.sh
```
The stage app includes a guard to disable the hourly expired-ad deletion job in `APP_ENV=staging`.

```bash
set -euo pipefail
umask 077
BASE=/srv/iradios/staging/backups
cd "$BASE"
sha256sum -c SHA256SUMS
test ! -e "$BASE/import-review" || { echo "Existing review folder; stop."; exit 1; }
install -d -m 700 "$BASE/import-review"
tar -xf iradios-prod-bson.tar -C "$BASE/import-review"
test -d "$BASE/import-review/dump/iradios"
docker exec iradios_stage-mongo-1 sh -ec \
  'mongodump --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db iradios_stage --archive --gzip' \
  > "$BASE/pre-prod-import-iradios-stage.archive.gz"
docker run --rm --network iradios_stage_internal \
  --env-file /etc/iradios/staging/compose.env \
  -v "$BASE/import-review/dump:/backup:ro" mongo:9.0.4-resolute \
  sh -ec 'mongorestore --host mongo --port 27017 --username root \
    --password "$STAGE_MONGO_PASSWORD" --authenticationDatabase admin \
    --gzip --noOptionsRestore --noIndexRestore --stopOnError \
    --nsInclude "iradios.*" --nsFrom "iradios.*" \
    --nsTo "iradios_import_review.*" /backup'
```
Import is into **`iradios_import_review`**, not `iradios_stage`, so the live stage site is unaffected. On errors, **stop**, keep the files, and investigate version/metadata compatibility. Do not force/drop any MongoDB database.

## E. Validate before promoting review data
```bash
docker exec iradios_stage-mongo-1 sh -ec \
  'mongosh --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" \
   --authenticationDatabase admin --eval '\''const d=db.getSiblingDB("iradios_import_review"); printjson({collections:d.getCollectionNames().length, stats:d.stats()});'\'''
```
Compare per-collection counts to production, check representative station/user documents **without printing their personal data**, then review indexes and any views that did not transfer. Full imported user data includes password hashes, OTP/reset tokens, payment IDs, emails and other personal data: private Basic Auth is necessary but not sufficient for long-term staging handling.

## F. Next controlled promotion (not automatic)
After validating the shadow import, stop only stage backend/frontend, capture another snapshot, restore validated documents into `iradios_stage`, rebuild/verify indexes, neutralize ephemeral reset/OTP/push tokens in **stage only** (preserving password hashes), copy the uploads, restart stage, and verify station/player/login flows. Do not turn on payment/push/live webhooks or real email delivery. Keep the canonical production dump encrypted and outside GitHub.
