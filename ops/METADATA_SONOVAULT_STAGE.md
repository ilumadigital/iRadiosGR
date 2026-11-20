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

## Fix based on the official SonoVault API documentation

`POST https://api.sonovault.now/v1/tracks/identify` takes raw encoded
audio with `Content-Type: application/octet-stream`, not JSON, multipart
or fingerprint-only data. Its documented response is
`{matched:boolean,results:[{title,artists,confidence}],credits_charged}`.
We retain the existing iRadios `status/metadata.music` contract to avoid
changing any UI/Now Playing/browser or lock-screen metadata.

**Do not add an iRadios confidence threshold.** The SonoVault API already
declares `matched:true` only after a candidate clears its own gate.
The previous application-side 0.5 confidence cutoff could discard valid matches.

For manual recognition only, the backend now captures up to ~45 seconds of
approved station audio (max 4 MiB raw in memory), transcodes with ffmpeg to
mono 16 kHz, 64 kbps MP3 (SonoVault's documented safe sample-rate floor),
and uploads **no more than 1 MiB** of raw audio bytes to SonoVault.
The 4 MiB capture is not uploaded as-is, so it does not cost extra credits.
Input and output are memory-only; no audio files are saved.
The vendor request has a 55-second timeout. This is still a best-effort
live-stream excerpt, not a guarantee that a match exists in the catalog.

`svk_test_` keys provide mocked data and are refused before any capture,
preventing imaginary songs from reaching the shared playlist. Use a
`svk_live_` key, with an eligible paid API plan and verified email.
Account eligibility cannot be determined from the key string alone.

Errors are now deliberately distinct, using the same existing alert UI:

- 401 invalid key: `SONO_AUTH`
- 402 missing payment method: `SONO_PAYMENT`
- 403 paid plan or email not verified: `SONO_PLAN`
- 429 rate limit/credits: `SONO_QUOTA` (uses RateLimit-Reset when supplied)
- 400 invalid request: `SONO_BAD_REQUEST`
- 413 uploaded body too large: `SONO_AUDIO_SIZE`
- 415 unsupported audio body: `SONO_AUDIO_FORMAT`
- malformed provider reply: `SONO_RESPONSE`
- matched result rejected by the iRadios metadata validator: `SONO_TRACK_FILTERED`
- recognized but MongoDB publication fails: `SONO_STORAGE`

An actual `matched:false` answer still produces the existing no-song message,
without publishing any false playlist entry. There is **no automatic
recognition**, stream registration, webhook, paid recurring monitoring, retry
loop or background Sonovault job.

## Deploy and read diagnostics (no paid calls)

```bash
cd /srv/iradios/staging/app
sudo ./ilumadev.sh
sudo bash ops/check-stage-sonovault-runtime.sh
sudo docker compose --env-file /etc/iradios/staging/compose.env \
  -f compose.stage.yml logs --tail=100 backend | \
  grep '\\[STAGE_SONOVAULT\\]' || true
```

The runtime checker verifies the live key prefix, feature switch and ffmpeg
presence. It never calls a paid endpoint or prints the key. A real end-to-end
test still requires clicking **Βρες το τραγούδι** on staging while signed in
with a paid-plan live key. Backend diagnostics log only safe error codes,
HTTP status, byte count and provider-reported credits—not secret values,
track names or radio URLs.
