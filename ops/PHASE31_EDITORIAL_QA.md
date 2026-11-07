# iRadiosGR v6.1 — Phase 3.1 staging release QA

## Editorial CMS (Admin only)

The existing `/admin/home-slides` editor supports three editorial **placements** independent of CTA destination:

- **Αρχική** (home): existing legacy slides stay visible with no migration
- **Μουσικό είδος** (genre): a specific existing genre
- **Περιοχή** (region): a specific existing region/city

Admin content supports draft/published, audience, priorities, optional start/end schedule, HTTPS or bounded uploaded images, and CTA links to station/genre/external HTTPS. The original admin-only backend protection remains in place.

Public endpoint `GET /api/home-slides` is home-only and preserves legacy documents. `?placement=genre&value=House` and `?placement=region&value=Αττική` filter to matching published and currently scheduled slides. `?placement=genre&tiles=1` and the corresponding region request return bounded (80 max) editorial tile records for Home. Never include private information or secrets in editorial copy: audience restrictions are for visible targeting, not a confidential-content boundary.

Editorial placements remain separate from sponsored ads; existing billing, ad labeling, impression and click attribution are untouched.

## Home / discovery / player

1. Admin feature slide shows station logo to the **right** of title; ambient colors are sampled from the real station logo using the browser when image CORS permits, with a deterministic dark/lime fallback. Slide artwork is still displayed in the background.
2. The **Άκου τώρα** / **Παίζει τώρα** button is based on the station actually being heard (`isPlaying` AND matching station ID), not merely on whether it is selected. A paused selected station resumes using the original audio handler.
3. Home playlist uses the station from the visible hero and displays **Τα τελευταία Tracks του {station.name}**. It stays connected to that station and only displays last-12 tracks from the authenticated playlist API, without inventing unavailable songs.
4. All guest song-metadata surfaces say **Συνδέσου στο iRadios για NowPlaying**. Guest radio playback remains freely accessible.
5. Home genre tiles use published genre slide imagery. Up to three published region slides can appear as featured region cards; selecting one filters station discovery.
6. Genre and Region screens use shared premium responsive station cards and dark popover filters instead of native selects. Region map, station profile links and sponsored banners remain.

## Manual staging acceptance

- Test guest and authenticated listener flows on `stage.iradios.gr` in browser widths 360, 390, 768, 1024, 1366, 1440, 1920. Confirm no horizontal body scroll and no overlap with sticky player.
- Test Admin: create **draft** slide targeting a genre, publish and verify it appears on that genre page and the relevant Home category tile only. Create a distinct region-targeted slide. Confirm another genre/region does **not** show these slides. Verify schedule and audience behavior, and that existing Home slides remain Home-only.
- Rotate hero slides; the adjacent station playlist must change to the featured station. It must never display songs of another station.
- Play a station from Home hero; confirm **Παίζει τώρα**. Pause from footer; confirm **Άκου τώρα**. Resume without replaying an unrelated station. Verify same on Genre/Region card play actions and favorites/recent.
- Confirm that guest user can **listen** but sees the exact login notice instead of metadata on Home, station profile, desktop, mobile, footer and playlist.
- Test popup filters using mouse, touch, keyboard Escape, click outside, search, reset, grid/list/map and combinations of genre/region and transmission. No native filter `<select>` remains in Genre/Region.
- Confirm sponsored ad insertions and click/impression tracking still work and are clearly marked; no change to Stripe/Nexi or other billing.
- Check radio streams without metadata still appear and are listenable in catalog. "Τώρα παίζουν" music-only list shows valid artist–track pairs and no bogus metadata.
- Confirm no admin controls are exposed to normal listeners. Confirm existing consent/role checks are intact.

## Deployment

After CI and review/merge to `staging`, deploy on Hostinger staging only:

```bash
cd /srv/iradios/staging/app
sudo ./ilumadev.sh
```

Do not deploy to production `play.iradios.gr` without separate production readiness and authorization.
