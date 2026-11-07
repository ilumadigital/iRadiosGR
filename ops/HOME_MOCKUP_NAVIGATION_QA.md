# iRadiosGR v6.1 — Home Mockup, Music Metadata & Navigation QA

## Design and content contract

**Home**
- Editorial slides and current-hero playlist share the **same station**. As an Admin slide moves to another approved station, the playlist title/logo and last-12 song history follow that station. With a genre/external slide or no slide, the playlist uses the active/fallback station.
- No independent station dropdown inside the Home/Station Profile/desktop-player song-history panel.
- At desktop widths, hero and playlist form a two-column showcase; below are verified **Τώρα παίζουν**, **Πρόσφατα**, **Αγαπημένα**, visual **Για σένα**, **Top σταθμοί**, genre tiles and searchable region chips.
- Genres and regions use buttons/tiles and an expandable filter panel, **no native select dropdowns** in the Home finder.
- Sidebar offers Home, categories, top, recommendations, recently listened, playlist, favorites and a few region shortcuts. Remaining regions can be discovered from the Home chips. All existing admin/broadcaster/agency routes and sponsored home banners remain.

**Music accuracy**
- Only logged-in users' Home **Τώρα παίζουν** is populated; it requires an approved station and an actual artist–track metadata string. Empty metadata, live announcements, status strings and generic broadcast slogans must be excluded.
- Radio streaming, station directory, favorites and recommendations remain available irrespective of music metadata; the listener must be able to find and hear talk radio.
- The last-12 playlist is an authenticated persisted history of observed station metadata; old records cannot be fabricated, and stations without valid song data show an empty state. Metadata may lag upstream station delivery.
- Optional external song artwork is fetched only after the track is verified. No album-cover image files are stored on the backend.

## Live staging QA

1. Deploy merged staging with `sudo /srv/iradios/staging/app/ilumadev.sh`. Confirm the deploy script reports success. **Never deploy to production from this change.**
2. On Home as a logged-in user, open an Admin slide pointing to Station A. Confirm right-hand playlist shows Station A (not your previously playing Station B). Change the slide and verify history updates to the new station.
3. Use a station with real metadata and a talk/news station with no music metadata. The first may appear under **Τώρα παίζουν**; the talk station must **not** appear there. Both remain playable in Browse.
4. Confirm no native station selector in Home right playlist, Station Profile playlist or desktop player's playlist drawer. Confirm no native genre/region select controls in Home Discover.
5. From sidebar, click **Κατηγορίες**, **Top σταθμοί**, **Πρόσφατα**, **Playlist σταθμού**, **Περισσότερες περιοχές**. Verify the correct section/filters open, without losing the playing stream.
6. Test keyboard navigation, carousel buttons, focus outlines, Greek genre names, region chip selection and search at mobile 360/390/430, tablet 768, laptops 1024/1366 and desktop 1440/1920.
7. Confirm guest access to radio streaming but not music metadata/history. Check admin slide editor access control and sponsored banner tracking.
8. Confirm central audio playback persists across Home → station page → favorites and in fullscreen, and no real Stripe payments are possible on staging.

## Known limits

- The current music discovery probe processes a bounded rotating subset of approved stations per 90-second polling pass, not every station at once. More scalable server-side metadata indexing/background scheduling should be treated as a separate project phase.
- No screenshot/browser-level QA was run by GitHub Actions. CI verifies syntax, test contracts, authorization boundaries and build. Production still requires a separate sign-off.
