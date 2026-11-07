# iRadiosGR — Production MongoDB export to staging (2026-11-07)

## Verified snapshot
Production Hetzner: `iradios-mongodb`, source database `iradios`, MongoDB 4.4.
Export verified by operator at 2026-11-07 16:34 UTC:
- `/root/iradios-stage-transfer-20261107/iradios-prod.archive.gz` — `mongodump --db iradios --archive --gzip`, 117 KB.
- `/root/iradios-stage-transfer-20261107/iradios-prod-uploads.tar.gz` — uploads from `/var/www/iradios-app/uploads`, 21 MB.
- `/root/iradios-stage-transfer-20261107/SHA256SUMS`.
- 520 documents in nine collections: 68 stations, 240 users, 96 subscriptions, 88 analytics, 17 email histories, 5 transactions, 4 ads, 2 bannerads, 0 chatmessages.
- This is a logical dump, NOT a write-consistent replica-set snapshot. Do not assume writes during dump were atomic.

Stage Hostinger: `mongo:9.0.4-resolute`, network `iradios_stage_internal`, stage DB `iradios_stage`, target review DB `iradios_import_review`.

## Critical security
- Production MongoDB is published to `0.0.0.0:4545` / `[::]:4545`; database listing succeeded without Mongo credentials. Assess and restrict external access immediately, confirming legitimate dependencies before changes. Docker can bypass UFW for published ports.
- Never copy production `.env`, Mongo root credentials, Stripe, Nexi, JWT, VAPID, SMTP keys, or tokens into stage or GitHub.
- Data dump includes personal information, password HASHES (not plaintext), potentially password-reset/OTP tokens, subscription/payment references. Only handle on trusted machines with encrypted storage, owner-only directories, secure SSH transfer. No public downloads, third-party uploads, or Git commits.
- Restore into the review database only; not into `iradios_stage` yet. Stage Nginx Basic Auth is not enough for unfettered production PII on a long-lived stage.
- Do not use `docker compose down -v` or `mongorestore --drop`.

## 1. Stage: update scheduler guard
```bash
cd /srv/iradios/staging/app
sudo -u iradios git pull --ff-only origin staging
sudo bash ops/deploy-stage.sh
```
The stage backend does not run its hourly destructive ad cleanup when `APP_ENV=staging`.

## 2. Stage: prepare secure destination (on Hostinger as root)
```bash
install -d -o root -g root -m 700 /srv/iradios/staging/backups/transfer-20261107
```

## 3. SSH transfer via trusted Ubuntu laptop
Replace `HETZNER_HOST` with the operator's existing Hetzner SSH address.
```bash
install -d -m 700 "$HOME/iradios-private-transfer"
scp root@HETZNER_HOST:/root/iradios-stage-transfer-20261107/iradios-prod.archive.gz "$HOME/iradios-private-transfer/"
scp root@HETZNER_HOST:/root/iradios-stage-transfer-20261107/iradios-prod-uploads.tar.gz "$HOME/iradios-private-transfer/"
scp root@HETZNER_HOST:/root/iradios-stage-transfer-20261107/SHA256SUMS "$HOME/iradios-private-transfer/"
scp "$HOME/iradios-private-transfer/"{iradios-prod.archive.gz,iradios-prod-uploads.tar.gz,SHA256SUMS} root@185.230.64.89:/srv/iradios/staging/backups/transfer-20261107/
```

## 4. Stage: verify exact checksums and back up existing stage database
```bash
set -euo pipefail
umask 077
BACKUP=/srv/iradios/staging/backups/transfer-20261107
cd "$BACKUP"
sha256sum -c SHA256SUMS
test ! -e /srv/iradios/staging/backups/stage-preimport-20261107.archive.gz || { echo "Stage backup exists, stop"; exit 1; }
docker exec iradios_stage-mongo-1 sh -ec 'mongodump --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db iradios_stage --archive --gzip' > /srv/iradios/staging/backups/stage-preimport-20261107.archive.gz
test -s /srv/iradios/staging/backups/stage-preimport-20261107.archive.gz
```
The stage baseline is preserved even though the initial restore only targets the review namespace.

## 5. Stage: trial restore compressed archive into isolated review DB
```bash
set -euo pipefail
BACKUP=/srv/iradios/staging/backups/transfer-20261107
docker run --rm --network iradios_stage_internal \
  --env-file /etc/iradios/staging/compose.env \
  -v "$BACKUP:/backup:ro" mongo:9.0.4-resolute \
  sh -ec 'mongorestore --host mongo --port 27017 \
    --username root --password "$STAGE_MONGO_PASSWORD" --authenticationDatabase admin \
    --archive=/backup/iradios-prod.archive.gz --gzip \
    --noIndexRestore --noOptionsRestore --stopOnError \
    --nsInclude "iradios.*" --nsFrom "iradios.*" --nsTo "iradios_import_review.*"'
```
This is a **compatibility trial**, not a supported/validated direct MongoDB 4.4 → 9.0 upgrade. MongoDB docs say restore is supported when source/destination have the same major version or FCV; BSON documents can sometimes restore into newer versions, but options/indexes may need migration. The source archive remains untouched.

## 6. Stage: count verification without exposing document contents
```bash
docker exec iradios_stage-mongo-1 sh -ec 'mongosh --quiet --username root \
  --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin \
  --eval '\''const d=db.getSiblingDB("iradios_import_review"); d.getCollectionNames().sort().forEach(n=>print(n+" "+d.getCollection(n).countDocuments({})));'\'''
```
Expected counts from snapshot: `stationanalytics 88, users 240, stations 68, subscriptions 96, emailhistories 17, transactions 5, ads 4, bannerads 2, chatmessages 0`. Empty collections may not materialize, depending on dump behavior.

## 7. Promotion to live stage: NOT AUTOMATIC
Before redirecting the stage app to this data, validate counts/types/references, rebuild indexes and unique constraints, create sanitized stage-only copies (remove reset tokens/OTP secrets, invalidate push device subscriptions, review payment/customer identifiers and emails), test stage-only authentication using a dedicated test account, restore uploads with correct permissions, and confirm payment/notifications/live-email external side effects are blocked. A separate confirmed, reversible procedure is required.

The stage backend never receives production server credentials. The production MongoDB container and data remain untouched.
