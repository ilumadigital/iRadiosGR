# iRadiosGR v6.1 — staging metadata & ACRCloud setup

**Staging only. Do not put .env, credentials or production dumps in GitHub.**

## Verified app configuration

- Docker Compose: /srv/iradios/staging/app/compose.stage.yml
- Docker Compose env: /etc/iradios/staging/compose.env (MongoDB stage passwords)
- Backend env_file: /etc/iradios/staging/backend.env (root:root, mode 0600)
- Ignored symlink: /srv/iradios/staging/app/backend/.env -> /etc/iradios/staging/backend.env

Docker Compose reads the backend file directly via env_file; no frontend .env is needed.

## Operator steps

1. Via SSH/SFTP, upload an existing .env to your private SSH home folder only.
   Do not use /srv/iradios/staging/uploads or public web roots.
2. Back up the current backend file **before** editing it:

   sudo cp -a /etc/iradios/staging/backend.env /etc/iradios/staging/backend.env.backup.$(date +%Y%m%d-%H%M%S)

3. Edit the current **staging** backend.env, keeping existing Mongo/JWT/SMTP settings unchanged:

   sudoedit /etc/iradios/staging/backend.env

   Add **stage/test ACRCloud credentials**:

   ACRCLOUD_HOST=identify-region.acrcloud.com
   ACRCLOUD_ACCESS_KEY=your-key
   ACRCLOUD_ACCESS_SECRET=your-secret

   The host must be a hostname in the official acrcloud.com domain, without https:// or a path.

4. Leave STAGE_ENABLE_ACRCLOUD=0 during initial metadata tests. Once cost and credential checks are approved, change it to **1** to authorize real recognition requests; this can incur API charges.
5. Verify root-only file permissions and Git-ignored env links:

   sudo chown root:root /etc/iradios/staging/backend.env
   sudo chmod 600 /etc/iradios/staging/backend.env
   sudo bash /srv/iradios/staging/app/ops/ensure-stage-env.sh

6. Confirm **names only** (never print secrets):

   sudo awk -F= '/^(ACRCLOUD_HOST|ACRCLOUD_ACCESS_KEY|ACRCLOUD_ACCESS_SECRET|STAGE_ENABLE_ACRCLOUD)=/ {print $1 " = PRESENT"}' /etc/iradios/staging/backend.env

7. Remove any temporary uploaded copy from the SSH home folder after securely transferring the necessary settings.

## Deployment

After the PR is reviewed/merged into the **staging branch only**, use:

    sudo /srv/iradios/staging/app/ilumadev.sh

This safely pulls staging and recreates stage containers; it refuses non-staging branches. Never use this as an instruction to deploy to production.

## Smoke checks

- GET /api/health is healthy.
- GET /api/metadata without a JWT returns HTTP 401.
- Listener (signed in) sees real song metadata on station profiles and Home. Some radio streams provide no metadata; do not invent song titles.
- Guest can play radio normally without metadata.
- With STAGE_ENABLE_ACRCLOUD=1, signed-in listeners can recognize audio from approved stations only. Test from station profiles with known working streams.
- ACRCloud rate-limits requests to 3 per user per 15 minutes. No audio sample is written to server files.
- Playback, cover-art URLs and SSL remain functional.

No environment file change alone can restore the old stage behavior: earlier stage code hard-disabled metadata and ACRCloud. Merge/deploy the reviewed code separately.

## Recognition troubleshooting — after isolated staging deployment

**Security first:** If keys have ever appeared in a screenshot, ticket or chat, rotate the
project Access Key/Secret Key in ACRCloud before enabling recognition. Never paste
their values into the chat, shell diagnostics or logs.

The project host is an **Identify host** from ACRCloud (example:
`identify-eu-west-1.acrcloud.com`), **not** a console URL or `https://` string.
The signed request uses the ACRCloud project keys, not account-wide REST API keys.

The server deliberately requires an additional opt-in switch. After replacing
exposed keys and confirming ACRCloud usage/billing is acceptable, edit
`/etc/iradios/staging/backend.env` using `sudoedit` and ensure exactly one line
for each of these names (do not commit this file):

```dotenv
STAGE_ENABLE_ACRCLOUD=1
ACRCLOUD_HOST=identify-eu-west-1.acrcloud.com
ACRCLOUD_ACCESS_KEY=YOUR_NEW_PROJECT_ACCESS_KEY
ACRCLOUD_ACCESS_SECRET=YOUR_NEW_PROJECT_ACCESS_SECRET
```

Replace the placeholders with private **new** project credentials; if you already
configured the host correctly leave it unchanged. Keep other stage environment
values, JWT, MongoDB and production connection settings untouched.

**Changes in env_file do not update an existing Docker container.** After the
reviewed staging code is merged, redeploy only staging to recreate backend and
frontend containers:

```bash
cd /srv/iradios/staging/app
sudo ./ilumadev.sh
sudo bash ops/check-stage-acrcloud-runtime.sh
```

The check prints **only** ON/OFF and PRESENT/MISSING (no secrets); it does **not**
call the billable ACRCloud API. If it shows OFF/NOT READY, solve the environment
problem before trying the button again.

Once the runtime check says READY TO TEST, sign in to staging and press
**Βρες το τραγούδι** once on a known working music stream while a song is playing.
The user-facing messages now distinguish:

| Result | Meaning |
| --- | --- |
| ACR_DISABLED / ACR_CONFIG | Stage switch off / missing or invalid credentials |
| STREAM_UNAVAILABLE / STREAM_FORMAT / STREAM_SHORT | Unable to capture a supported, long-enough music sample from that approved station |
| ACR_AUTH | ACRCloud rejected the project key, signature or authentication; check/rotate credentials |
| ACR_QUOTA | ACRCloud project request or QPS limit reached; check project usage/billing |
| ACR_RATE_LIMIT | Local per-user limit (3 recognitions, 6 stream captures per 15 minutes) |
| No result (ACRCloud 1001) | The service received the request but did not match the current audio; try during a recognizable song |

If still failing, **without disclosing secrets**, inspect only diagnostic event
names from the staging backend:

```bash
cd /srv/iradios/staging/app
sudo docker compose --env-file /etc/iradios/staging/compose.env -f compose.stage.yml logs --tail=100 backend | grep '\[STAGE_ACRCLOUD\]' || true
```

Do not paste complete Docker logs, HTTP headers, Authorization tokens or raw
ACRCloud responses into a chat. Give the event type and the safe frontend
error code only. **No live ACRCloud recognition has been verified by CI**; CI
uses synthetic offline tests and cannot access your Hostinger secrets or radio
streams. Radio streaming stays public and independent of recognition.
