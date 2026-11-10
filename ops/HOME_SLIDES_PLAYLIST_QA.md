# iRadiosGR v6.1 — Home Slides, Playlist & Desktop Player QA

Implementation branch: `feat/phase3-home-slides-playlist-desktop-player`. Deploy to Hostinger **staging only** after a green CI/merge. The production player at `play.iradios.gr` must not be modified.

## Admin slides (editorial content, not advertising)

Open the staging app as an **Admin** and navigate to **Admin Panel → Slides Αρχικής** (route `/admin/home-slides`).

1. Create a **Draft** first with title, subtitle, image (HTTPS or uploaded JPG/PNG/WebP up to 8MB), audience, priority and CTA.
2. Choose an approved station, an existing genre, an external HTTPS link, or no target. Test the preview.
3. Publish when ready. The Home carousel reads published, date-valid slides automatically. Highest priority first; no application rebuild required for content edits.
4. Test 2+ slides: arrow navigation, the 8.5-second rotation (reduced-motion and hover pause), CTA to radio station/genre, member-vs-guest visibility, responsive image.
5. Edit/unpublish/delete and confirm updates after cache expiry (up to 30 seconds). **Do not upload production secrets or confidential creative**. Slides are public editorial content.

API: public `GET /api/home-slides`; ADMIN-only `GET/POST/PUT/DELETE /api/admin/home-slides`; ADMIN-only `POST /api/admin/home-slides/upload` with bearer token. Returned images use `/media/visuals/slides`, stored in the stage uploads volume. User cover-art files are **not** stored on the server.

## Real last-12 song history

For each approved station, authenticated `/api/metadata` reads from the approved MongoDB station stream/metadata URL and records changes to an independent `StationPlaylist` document, max 12 title-artist observations per station.

- No placeholder songs are inserted. If no legitimate artist–song metadata arrives, the panel honestly shows an empty state.
- Logged-out users can hear radio but must log in to view the playlist.
- Try two stations with metadata: after the upstream changes song, verify distinct last-12 lists with time, song, artist. Refresh and restart the container to verify persistence.
- Artwork is fetched as remote cover URLs on visibility, never downloaded into a server album-cover directory.
- New endpoint `GET /api/stations/:id/playlist` requires JWT and station approval; test anonymous 401, invalid ID 400, non-approved 404. No admin CRUD for song history.

**Operational limitation**: history begins accumulating once staging deploys and listeners request authenticated station metadata. Existing songs cannot be reconstructed retroactively. The original production metadata route is unchanged; production release needs a separately reviewed metadata-history integration.

## Home discovery & personalized content

- Personalized greeting, featured slides, playlist of selected/current station, station finder with tabs `Για σένα`, `Top`, `Πρόσφατα`, `Αγαπημένα`, `Όλοι`, with searchable genre/region filters.
- The preferred station genres are derived from the listener's actual favorites/recent station list. Guests get sensible featured/popular ordering, never fabricated user preferences.
- Existing sponsored home banners remain separately labeled and retain their tracking. Editorial slides are not sponsored ads.
- Opening Discovery should **not** stop the global radio stream. Check play/pause, ad playback and re-navigation with station switching.

## Full-screen desktop player

- Desktop footer expand opens the cinematic, wide **song-left / art-right** radio player. The slide/Deseo DJ mock graphic is not a real player asset.
- Show real song and artist when available to logged-in users, with real external cover artwork on the right. Otherwise show station name and logo with explicit unavailable/guest metadata state.
- Live radio has no seekable song progress. Next/previous buttons change **stations**, not tracks.
- Test play/pause, buffering, ads, station favorites, volume, recognition, playlist drawer, Escape and the close button. Audio element remains in `App.jsx`.
- Test at 1366×768, 1440×900, 1920×1080; on mobile the separate mobile mini/full player remains in use.

## Deployment and rollback

1. Inspect CI on the feature PR; merge into `staging` only after green checks.
2. On Hostinger staging: `sudo /srv/iradios/staging/app/ilumadev.sh`.
3. Verify the deploy script's terminal success and health endpoints, then inspect functionality and UI on `https://stage.iradios.gr`.
4. Do not imply live data/cover art/playlist is verified before testing against actual stations. Keep all payment traffic disabled unless explicitly performing a guarded Nexi Sandbox UAT.
5. If a new error appears, capture **nonsecret** logs and create a targeted fix; never copy live secrets into the GitHub repository.

No production deployment occurs automatically from GitHub merges.
