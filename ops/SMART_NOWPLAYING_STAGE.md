# iRadiosGR — Smart NowPlaying / ACRCloud Stage rollout

**Release boundary:** Staging only (`stage.iradios.gr`); no production changes or bills from CI.
Backend audio fingerprint uploads may be billed by ACRCloud. This feature is **OFF by default**.

## Actual behavior

1. Select the ten highest-played **approved music** stations (`plays` descending, station ID tie-break). Exclude news, talk, sports, political, religious and informational genre/name variants. Refresh list every five minutes.
2. For each Top-10 station, consult its DB-owned native music metadata. Real **artist – title** is authoritative: never run automatic ACRCloud. Explicitly reject radio slogans, LIVE SHOW, programme titles, station names and timestamps disguised as songs.
3. Empty metadata → auto recognition only if a real playing client sent a recent anonymous heartbeat; public listening remains free. The stage Socket.IO gateway is disabled, so the browser makes a bounded heartbeat using an ephemeral random UUID (no login, user ID or station URLs).
4. Nonempty but invalid metadata (LIVE SHOW, 07.26 εκπομπή, station's own name) → run automatic recognition even if nobody is listening.
5. The same station is considered **at most every 5 minutes**; two stations at a time may be examined. ACRCloud no-result is **not a song**. Do not add it to the Home carousel or playlist.
6. Manual ACRCloud recognition is allowed for signed-in users on any approved station within the existing per-user limits. A successful manual result is **shared for 4 minutes**. Automatic recognized results are shared for up to 5 minutes. Correct native metadata supersedes *automatic* ACR; manual overrides its station temporarily for four minutes.
7. All signed-in listeners see one common `/api/metadata` result: `title`, `source:'station'|'acrcloud'|'none'`, `foundWithAI`, optional `recognizedAt`, `expiresAt`. The last 12 real songs store `source:'acrcloud'` for the **Found with AI** badge; no image files or stream samples are written to disk.
8. Browser / iPhone Media Session: logged-in track title/artist; AI album `{Station Name} - iRadios AI`; guest title **Login στο iRadios για NowPlaying**. Ordinary song updates occur every 5 minutes, with instant station, login, ads or first-AI updates. Actual iOS lock-screen updates are best effort: Safari/iOS can suspend background JavaScript and may delay refresh until the web app resumes.

## Secret-safe Hostinger operator enablement

**Rotate previously exposed ACRCloud project keys first.** Keep the existing server-only `/etc/iradios/staging/backend.env`, not a GitHub `.env` or a public folder.

Verify `ACRCLOUD_HOST` is the identify host without scheme, and the current project credentials are present. Edit with `sudoedit /etc/iradios/staging/backend.env`:

```dotenv
APP_ENV=staging
STAGE_ENABLE_ACRCLOUD=1
STAGE_ENABLE_AUTO_ACRCLOUD=0
STAGE_AUTO_ACR_DAILY_LIMIT=30
```

The low 30-call limit is suitable for the **first paid, manual staging trial**. After checking quotas, pricing, Top-10 list and live playback, change `STAGE_ENABLE_AUTO_ACRCLOUD=1`, and choose a deliberate daily limit. Full five-minute Top-10 coverage could make **10 x 12 x 24 = 2,880 ACRCloud attempts per 24 hours**; the server hard-caps the configured daily budget at 2,880. The counter is in Mongo, not reset by restarting the container. Per-user manual recognitions are separately limited.

After the PR passes review and is merged to `staging`:

```bash
cd /srv/iradios/staging/app
sudo ./ilumadev.sh
sudo bash ops/check-stage-acrcloud-runtime.sh
```

The runtime checker prints only ON/OFF/status; no credentials. Docker Compose loads `/etc/iradios/staging/backend.env` directly on container recreation; changing that file without restarting/recreating the container is **not enough**. Once the environment opt-in is changed, rerun the same isolated staging deployment.

## Safe QA checklist

- Check a music station with valid native artist/title: no **Found with AI** and no automatic ACR call.
- Check Top-10 with `LIVE SHOW`, `07.26 εκπομπή` or station name: if enabled, one bounded attempt every 5 minutes even without listeners; no fake song on 1001/no match.
- Check Top-10 with empty native metadata: no auto call without a recent actual playback heartbeat, but an authenticated/guest listener actively playing the audio can allow it.
- Check stations #11+ and information/news/sports: no **automatic** attempts.
- Press **Βρες το τραγούδι**: when matched, verify the same song appears in Home, Profile, Playlist, desktop/mobile player with **Found with AI**, and expires from current metadata after 4 minutes.
- Check paused streaming, tab closed, station switched, ads, failed stream, expired match and daily quota.
- In browser Media Session and iPhone lock screen verify title/artist/album; guests must see **Login στο iRadios για NowPlaying**. Expect possible delayed background updates on iOS.
- Check continued streaming for unauthenticated guests; music metadata and playlist endpoints must still require a signed-in JWT.

Safe diagnostics (event names ONLY, not full logs):

```bash
cd /srv/iradios/staging/app
sudo docker compose --env-file /etc/iradios/staging/compose.env -f compose.stage.yml logs --tail=120 backend | grep -E '\\[(AUTO_ACR|STAGE_ACRCLOUD)\\]' || true
```

The CI tests do not contact external radio streams or ACRCloud. There has been no live end-to-end verification with project credentials. Production rollout requires separate cost/security/real-device QA.
