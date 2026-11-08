# iRadiosGR staging — manual SonoVault recognition

Staging only. Never put keys, .env values, or private streaming URLs in Git.

## What stays the same

The existing **Βρες το τραγούδι** button, design, request route
`POST /api/recognize-proxy`, loading/error messages, artist/title layout,
cover-art lookup, playlist badge, RDS transitions, and browser/iOS media session
all remain unchanged. The backend adapts SonoVault's native response to the
existing iRadios response contract. The internal `source: "acrcloud"` string is
retained **solely as a legacy UI/metadata identifier for AI recognition**.
No request is sent to ACRCloud.

- Only the authenticated manual button calls SonoVault.
- A backend captures bounded raw audio from the **approved station URL in MongoDB**,
  not any user-provided URL.
- One manual match is saved to the shared station playlist for the rolling
  **last 30 minutes** and is visible to signed-in listeners network-wide.
- The existing **four-minute** current AI override remains unchanged, to avoid
  falsely claiming an old song is still playing for 30 minutes. Normal native
  metadata continues to refresh on its own free background scanner.
- The old automatic recognition worker (category Top-5 / listener-driven / timer)
  is disconnected; even `STAGE_ENABLE_AUTO_ACRCLOUD=1` cannot start it.
- Three vendor attempts and six stream captures per user per 15 minutes remain
  in force. Concurrent clicks for the same station on one backend share one
  paid request. No stream sample is written to disk.
- The legacy client-upload endpoint `POST /api/recognize` is decommissioned.

## Required Hostinger staging backend .env

Actual server location: `/etc/iradios/staging/backend.env`
(loaded by `compose.stage.yml` through `env_file`, not the frontend).

```dotenv
STAGE_ENABLE_SONOVAULT=1
SONOVAULT_API_KEY=PASTE_YOUR_PRIVATE_KEY_HERE
```

The vendor URL is intentionally pinned server-side to
`https://api.sonovault.now/v1/tracks/identify`; no base URL or extra secret
is required. `MUSIC_RECOGNITION_PROVIDER`, `SONOVAULT_API_URL`,
`ACRCLOUD_HOST`, `ACRCLOUD_ACCESS_KEY`, `ACRCLOUD_ACCESS_SECRET`,
`STAGE_ENABLE_ACRCLOUD`, and `STAGE_ENABLE_AUTO_ACRCLOUD` are not used by
the new recognition pipeline. Delete old provider variables when convenient.

Important: **SonoVault's audio identify endpoint requires a paid plan**.
A free-plan key will be rejected with HTTP 403. Audio identify costs
10 + ceil(upload MB) SonoVault credits per call according to their documentation.

## Deployment and verification (staging only)

```bash
sudo cp -a /etc/iradios/staging/backend.env /etc/iradios/staging/backend.env.backup.$(date +%Y%m%d-%H%M%S)
sudoedit /etc/iradios/staging/backend.env
sudo chown root:root /etc/iradios/staging/backend.env
sudo chmod 600 /etc/iradios/staging/backend.env
cd /srv/iradios/staging/app
sudo ./ilumadev.sh
sudo bash ops/check-stage-sonovault-runtime.sh
```

The final check prints only key presence and enabled state; **no paid vendor
request**. Then sign in and click the unchanged button once during a known song.
Verify the same station's playlist and metadata from a second signed-in device.
A real-key/live-radio end-to-end check cannot be run in CI.

Do not share the API key, any backend.env contents, request headers, or complete
recognition logs. If it is exposed, rotate it in SonoVault.

## Recognition-result reliability fix

SonoVault analyzes around 30 seconds per window. The previous stage adapter
captured only 15 seconds of audio and allowed only 20 seconds for identification,
which could cause empty or timed-out results even though the station was playing.

The stage adapter now captures **up to 30 seconds**, limited to **900 KB**
(one started MB of upload for pricing), and waits up to **50 seconds**
for the provider's response. There is still only **one** billable
identify call per manual action (concurrent actions on one backend are deduped).

A valid provider `matched:true` payload is mapped to the existing UI contract:
`{status:{code:0},metadata:{music:[{title,artists:[{name}]}]}}`.
Explicit `matched:false` becomes the familiar no-result status 1001.
Malformed `matched:true` data is reported as a service error rather
than silently shown as "no song".

For debugging without exposing secrets:

```bash
cd /srv/iradios/staging/app
sudo docker compose --env-file /etc/iradios/staging/compose.env \
  -f compose.stage.yml logs --tail=100 backend | \
  grep '\[STAGE_SONOVAULT\]' || true
```

The logs expose only operation/status and the number of captured audio bytes,
never the key, stream URL, audio, track title, or provider response body.
An actual real-key request needs to be run manually on staging because CI must
never spend SonoVault credits.
