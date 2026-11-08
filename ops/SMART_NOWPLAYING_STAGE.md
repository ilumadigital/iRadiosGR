# iRadiosGR — Smart NowPlaying / ACRCloud Stage rollout

**Release boundary:** Staging only (`stage.iradios.gr`); no production changes or bills from CI.
Backend audio fingerprint uploads may be billed by ACRCloud. This feature is **OFF by default**.

## Actual behavior

1. Select the **five most popular approved stations in EACH music category** (the same exact `genre` field used in the catalog). Sort by `popularity` descending, then `plays` descending and station ID as deterministic tie-breakers. Exclude all news/informational, talk, sports, political, religious genre/name variants **before** selecting the five. Recalculate every five minutes. Also inspect up to 20 currently listened, approved music stations **outside** those category Top-5 selections per tick, rotating fairly.
2. For each selected category Top-5 station, consult its DB-owned native music metadata. Real **artist – title** is authoritative: never run automatic ACRCloud. Explicitly reject radio slogans, LIVE SHOW, programme titles, station names and timestamps disguised as songs.
3. Empty or invalid metadata → selected category Top-5 music stations automatically trigger recognition **without any listener and without anyone pressing Βρες το τραγούδι**. No need to wait for manual recognition. Music stations **outside** their category Top-5 require a recent anonymous playback heartbeat before auto recognition (for either missing or invalid metadata). Public listening remains free. The stage Socket.IO gateway is disabled, so the browser makes an ephemeral UUID heartbeat without a login, user ID or stream URL. This is a client signal, not cryptographic proof of audio playback; approved DB station checks, cooldowns and daily cost caps remain required.
4. Nonempty but invalid metadata (LIVE SHOW, 07.26 εκπομπή, station's own name) is handled identically to missing metadata. **News and talk stations are not scanned**, even if popular or listened to. Valid native tracks do not incur automatic AI recognition.
5. The same station is attempted **at most every 5 minutes**, with two stations examined concurrently. Larger numbers of categories, slow streams or an exhausted daily budget can delay/skip attempts; five minutes is a cooldown, **not a guaranteed update for every radio**. ACRCloud no-result is **not a song**. Do not add it to Home or playlist. The configured daily limit is global across **all** categories and listened stations, hard-capped at **2,880 billable attempts/day**.
6. Manual ACRCloud recognition is allowed for signed-in users on any approved station within the existing per-user limits. A successful manual result is **shared for 4 minutes**. Automatic recognized results are shared for up to 5 minutes. Correct native metadata supersedes *automatic* ACR; manual overrides its station temporarily for four minutes.
7. All signed-in listeners see one common, **server-prefetched MongoDB-only** `/api/metadata` result: `title`, `source:'station'|'acrcloud'|'none'`, `foundWithAI`, optional `recognizedAt`, `expiresAt`. The **rolling last 30 minutes** of real songs persist per station in MongoDB with their source, including `source:'acrcloud'` for the **Found with AI** badge. Consecutive duplicate songs are suppressed atomically; stale songs are filtered on read. The active 4/5-minute AI result is also persisted with expiry so restarted/multiple backend instances agree. No images or stream samples are written to disk.
8. Browser / iPhone Media Session: guests see title **Login στο iRadios για NowPlaying**, artist **station name**, album **iRadios**. Signed-in listeners without a verified song see title **Τώρα Ακούς**, artist **station name**, album **iRadios** (never generic radio/live-show metadata). When a verified song is available, title is **track title**, artist is **performer**, and album is `{Station Name} - iRadios` for native metadata or `{Station Name} - iRadios AI` for ACRCloud recognition. Ordinary song updates occur every 5 minutes, with instant station, login, ads or first-AI updates. Actual iOS lock-screen updates are best effort: Safari/iOS can suspend background JavaScript and may delay refresh until the web app resumes.

**RDS presentation (20-second slots):** When an authenticated listener has both a verified song and an active scheduled DJ with valid artwork, the app alternates between the track/cover and the DJ/show/photo every **20 seconds** (a full song + DJ cycle is 40 seconds). The Station Profile, desktop and mobile players use an 800ms ease-in-out visual crossfade and respect reduced-motion settings. The browser/iOS Media Session updates its metadata at the same 20-second boundaries when JavaScript is active; operating-system lock screens do not support CSS animations, and suspended iOS background pages may delay updates. With only music, keep music; with only DJ artwork, show DJ; with neither, keep the station fallback. This is a display-only change: it does not request additional ACRCloud recognitions and never stores DJ labels as songs.

9. **Phase 3.6 native metadata:** Every minute a free background scanner reads approved radio-native titles, verifies real songs and persists `nativeNow`. It probes up to 256 stations per pass with 20 concurrent requests, cycling through the catalog; catalogs larger than one pass need longer to cover. Identical songs refresh only an internal confirmation timestamp; no public song or playlist churn. Each cached native song expires eight minutes after last successful verification. Home reads native+AI from a single MongoDB `/api/metadata/live` feed, and Station Profile GET never fetches radio metadata itself. Spotify appears only for credible artist/title songs (native search or AI ID with matching song). See `ops/PHASE36_NATIVE_CACHE_QA.md`.

## Secret-safe Hostinger operator enablement

**Rotate previously exposed ACRCloud project keys first.** Keep the existing server-only `/etc/iradios/staging/backend.env`, not a GitHub `.env` or a public folder.

Verify `ACRCLOUD_HOST` is the identify host without scheme, and the current project credentials are present. Edit with `sudoedit /etc/iradios/staging/backend.env`:

```dotenv
APP_ENV=staging
STAGE_ENABLE_ACRCLOUD=1
STAGE_ENABLE_AUTO_ACRCLOUD=0
STAGE_AUTO_ACR_DAILY_LIMIT=30
```

The low 30-call limit is suitable for the **first paid staging trial**. To activate the requested fully automatic category-Top-5 recognition, set `STAGE_ENABLE_AUTO_ACRCLOUD=1` and choose a deliberate daily limit after checking vendor pricing. With **C music categories containing at least five eligible radios**, unrestricted five-minute coverage could require **5 × C × 12 × 24** ACRCloud calls/day, which can quickly exceed the global hard cap of 2,880. The app will therefore **skip recognitions when the daily allowance is used**, rather than exceed the cost ceiling. This MongoDB counter survives process restarts. Per-user manual recognitions have separate per-user limits. GitHub merges cannot modify the server-local `/etc/iradios/staging/backend.env`.

After the PR passes review and is merged to `staging`:

```bash
cd /srv/iradios/staging/app
sudo ./ilumadev.sh
sudo bash ops/check-stage-acrcloud-runtime.sh
```

The runtime checker prints only ON/OFF/status; no credentials. Docker Compose loads `/etc/iradios/staging/backend.env` directly on container recreation; changing that file without restarting/recreating the container is **not enough**. Once the environment opt-in is changed, rerun the same isolated staging deployment.

## Safe QA checklist

- Check a music station with valid native artist/title: no **Found with AI** and no automatic ACR call.
- Check the Top-5 in **each music genre**, ranked like the catalog (`popularity`, then `plays`): when metadata is **empty or invalid**, recognize autonomously even with zero listeners and no button press; never insert fake songs on 1001/no match.
- Check valid artist/title on Top-5: no automatic ACRCloud call (native source is authoritative). Check that news/talk/sports genres and news-branded radios are excluded.
- Check a station outside its **category Top-5**: no automatic attempts without an anonymous listening heartbeat; with a listener and bad/empty metadata it remains eligible. All attempted stations share the same daily cap.
- Press **Βρες το τραγούδι**: when matched, verify the same song appears in Home, Profile, Playlist, desktop/mobile player with **Found with AI** for all signed-in listeners; restart the backend to verify the current match is rehydrated from Mongo. It expires from current metadata after 4 minutes; its playlist history remains visible for up to 30 minutes.
- Check paused streaming, tab closed, station switched, ads, failed stream, expired match, same-track deduplication, 30-minute cutoff and daily quota.
- In browser Media Session and iPhone lock screen verify title/artist/album; guests must see **Login στο iRadios για NowPlaying**. Expect possible delayed background updates on iOS.
- Check continued streaming for unauthenticated guests; music metadata and playlist endpoints must still require a signed-in JWT.

Safe diagnostics (event names ONLY, not full logs):

```bash
cd /srv/iradios/staging/app
sudo docker compose --env-file /etc/iradios/staging/compose.env -f compose.stage.yml logs --tail=120 backend | grep -E '\\[(AUTO_ACR|STAGE_ACRCLOUD)\\]' || true
```

The CI tests do not contact external radio streams or ACRCloud. There has been no live end-to-end verification with project credentials. Production rollout requires separate cost/security/real-device QA.
