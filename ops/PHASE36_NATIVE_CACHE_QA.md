# Phase 3.6 — Two-minute Native Song Prefetch / Instant Now Playing

## What changes

- A **free background worker**, not the visitor's browser, probes approved radio streams for native song metadata **every two minutes** (staging only). Uses the existing DNS-pinned and SSRF-blocking radio fetch. The worker starts after backend boot even with no listeners and even if paid ACRCloud is disabled.
- Each successful `Artist - Title` is persisted in the MongoDB station playlist document as `nativeNow`. The station's rolling playlist history still records only actual song transitions; AI tracks keep their `acrcloud` provenance.
- If the same song is confirmed in the next two-minute probe, only its **internal confirmation time** is refreshed. `nativeNow.raw`, `changedAt` and the public song card remain unchanged. No duplicate Home tile or unnecessary artwork refresh.
- Cached native songs are treated as recently on-air only for **eight minutes after last successful verification**. Missing/upstream-timeout alone does not immediately delete a song; explicit DJ/show metadata invalidates the cached native song. Expired/unavailable native metadata allows the existing AI fallback.
- `GET /api/metadata?stationId=<approved-object-id>` reads MongoDB only (quick display in **Station Profile**, desktop/mobile player, lock screen). It never contacts a remote radio station synchronously.
- `GET /api/metadata/live` combines current native cache and active shared AI matches in one read. **Home → Τώρα παίζουν** fetches only this shared feed, instead of each browser concurrently querying dozens of metadata URLs. Client checks for changes every 15 seconds; current radio player polls every 30 seconds.
- The Top-5-per-music-genre **paid AI worker remains separate**, with the previous five-minute per-station cooldown and unchanged per-day vendor cap. There are no new ACRCloud charges from the two-minute native scanner.

## Scale limit

The VPS is protected by **160 approved stations per background pass and 20 concurrent probes**. The worker advances through the catalog in stable ID order, continuing in the next pass; if there are more than 160 stations or sources respond very slowly, some may be checked less often than every two minutes. This avoids thousands of immediate external connections. The fast UI feed does not depend on the number of simultaneous listeners.

## Spotify and lock screen

- Only credible `Artist - Title` music metadata is eligible for a Spotify action. Reject show names, DJ sets, `LIVE SHOW`, slogans, timestamps, announcements and unknown stream states.
- For a valid native track, the link is a **Spotify search**, not an unverified claim that it matched a specific Spotify track. Direct Spotify track IDs can be shown only when ACRCloud provides a valid track ID for the *same current song*; previous station IDs are never reused.
- Logged-in listener with no valid song: Media Session **title = station name**, **artist = iRadios GR**. Existing guest rule (title = `Login στο iRadios για NowPlaying`) remains.
- iPhone Safari may suspend scripts while fully locked, so the OS can defer later changes. The latest cache is restored promptly when the page resumes.

## Staging deploy and smoke checks

Run on the staging VPS, after merge to staging:

    cd /srv/iradios/staging/app
    sudo ./ilumadev.sh
    node ops/check-phase36-native-cache.cjs
    sudo bash ops/test-public-stage.sh

Log in and open the Home / Station Profile on a station with valid public native metadata. Verify the song appears quickly without pressing Play or AI. Verify the same song remains visually unchanged after two minutes and a changed title appears on the next scan + browser poll. For an invalid or missing metadata station, check AI fallback if stage AI opt-in is enabled and within quota.

Use guest session to confirm private song endpoints require JWT. Check malformed `DJSET - LIVE SHOW`, `Artist - Radio Show`, station names and promotional metadata have **no Spotify link**. On iPhone, check the logged-in no-metadata artist exactly `iRadios GR` and that recognized AI album is `{station} - iRadios AI`.

## Production boundary

No production service or credentials are changed. Staging deployment requires running the operator script. CI runs offline with fake MongoDB/streams and is **not** a substitute for staging smoke tests or real-device verification.
