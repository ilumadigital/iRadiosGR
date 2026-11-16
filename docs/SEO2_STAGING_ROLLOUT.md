# iRadios SEO 2.0 — staging rollout & acceptance

## Scope
Branch \`feat/seo2-dynamic-stations-20261116\`, PR #144, target \`staging\`.
Production is out of scope. Do not copy this configuration into production without
reviewing production routing, indexing policy, asset hosts and privacy boundaries.

### Architecture
- Backend: \`services/seo2Core.js\`, \`seo2Routes.js\`, \`seo2Render.js\`, \`seo2Image.js\`.
- All user agents receive the **same semantic HTML** with the existing Vite/React
  scripts. React mounts the interactive listener app after initial HTML. We do not
  serve fake SEO copy only to robots.
- Browser SEO preview uses \`frontend/src/utils/seoPreview.js\`.
- Only \`status=approved\` stations appear; no unauthenticated access to
  \`/api/stations/:id/playlist\`. Protected ACR/playlist history and broadcaster
  drafts are not included in SEO or \`llms.txt\`.
- Mongoose stamps \`seoUpdatedAt\` only for published content edits and stores up to
  20 previous slugs. Old slugs redirect with HTTP 301 to the current canonical.
- Profile snippets now combine the broadcaster's own description with non-duplicated public show/category/location facts. The client preview uses the same rule.
- Public radio schema includes declared secondary genres and terrestrial broadcast frequency. The first published presenter FAQ remains visible after React mounts.
- OG artwork is deterministic for a given station revision: a stable programme highlight is shown, not an unverified live ON AIR claim. Remote logo/cover downloads have a four-second limit, a five-MiB cap, supported image MIME allowlist, and no redirects.
- New profiles display genuine schedule and factual FAQ information. Do not
  treat schema markup or \`llms.txt\` as guaranteed Google rich results.

### Before merge
1. Verify all PR CI checks pass, particularly \`Staging source validation\` and Vite build.
2. Review changed code and the staging Nginx routing.
3. Confirm there are no blocking merge conflicts.
4. Verify the Docker backend can reach the frontend HTML template on
   \`http://frontend/index.html\` over the internal Compose network.

### Deploy (manual only)
1. Merge reviewed PR into \`staging\`. A push alone does **not** deploy.
2. SSH into the staging VPS:
   \`\`\`bash
   cd /srv/iradios/staging/app && sudo ./ilumadev.sh
   \`\`\`
3. The **host** Nginx config is not managed by \`ilumadev.sh\`. Review and apply the
   new SEO locations once, preserving SSL and the staging global noindex headers:
   \`\`\`bash
   sudo cp -a /etc/nginx/sites-available/iradios-stage \
     /etc/nginx/sites-available/iradios-stage.pre-seo2
   sudo diff -u /etc/nginx/sites-available/iradios-stage \
     /srv/iradios/staging/app/ops/nginx-stage.conf || true
   # After verifying the diff, then:
   sudo install -m 644 /srv/iradios/staging/app/ops/nginx-stage.conf \
     /etc/nginx/sites-available/iradios-stage
   sudo nginx -t && sudo systemctl reload nginx
   \`\`\`
   If the host's live config diverged, **merge only the location rules** instead
   of overwriting unrelated changes. Never remove the staging
   \`X-Robots-Tag: noindex, nofollow, noarchive\` or \`robots.txt Disallow: /\`.

### Verify on staging
Run after both Compose and host Nginx are deployed:
\`\`\`bash
for path in / /map /robots.txt /llms.txt /sitemap.xml \
  /sitemap-categories.xml /sitemap-regions.xml /sitemap-stations-1.xml \
  /sitemap-images-1.xml; do
  echo "=== $path"
  curl -fsSI "https://stage.iradios.gr$path" | \
    grep -Ei 'HTTP/|Content-Type:|X-Robots-Tag:|Cache-Control:'
done
\`\`\`
Check a **real approved slug** at \`/station/{slug}\` and \`/og-image/{slug}.png\`.
Inspect the HTML: one canonical, one description, a valid FAQPage (with matching
visible questions), a RadioStation node, valid BroadcastEvent dates with
Athens offsets, and **no** private song/playlist history.

Use Google Rich Results Test, validator.schema.org, Facebook Sharing Debugger,
and X Card preview to test the **production** host only after an approved
production deployment. Staging deliberately blocks indexing.

### Runtime configuration
- \`FRONTEND_URL\`: existing canonical host (already configured for staging).
- \`SEO_FRONTEND_TEMPLATE_URL\`: optional override, defaults to
  \`http://frontend/index.html\` inside Docker.
- \`SEO_OG_IMAGE_HOSTS\`: optional comma-separated list of explicitly trusted
  **HTTPS image hosts**; untrusted station image hosts fall back to branded
  typography instead of an unsafe server-side fetch.
- No new paid, gateway, Mailpit or advertising env keys.

### Rollback
Roll back the host Nginx config from the backup, test it, reload Nginx, and
redeploy the previous validated staging commit. Do not roll back the database
to remove harmless \`seoUpdatedAt\` or \`previousSlugs\` fields.

### Known boundaries
- SSR here is HTML pre-render + SPA mount, not full React DOM streaming
  hydration. It avoids bot-specific responses and displays real content
  before JavaScript. Validate parity for real pages after React loads.
- Existing protected, 30-minute playlist history stays private and is not
  advertised as an indexable track catalog.
- Production indexing and routing remain separately gated; staging is not a
  Search Console production-indexing test.

### SEO 2.1 — Flash-free loading, programme FAQ and station layout
- Initial server-rendered SEO HTML is **real semantic content for every user agent**, with critical CSS so that a no-JavaScript visitor sees a usable, branded page.
- A single branded startup cover is painted before React downloads. Once the React 1.4-second Preloader mounts, it removes the temporary cover in a layout effect. It is **not a bot-only copy or hidden SEO text**; the underlying SSR document is the same for people and crawlers.
- The station desktop layout now uses a full-height, internally scrolling playlist on the left, with description and up to five FAQ cards stacked on the right. Mobile retains natural vertical flow and bounded playlist scrolling.
- `stationFaq` generates up to five distinct answers from approved, public profile facts: genres/subgenres, today's broadcast programme in Europe/Athens, declared show hosts, published frequency/location, and how the existing last-30-minute playlist works.
- FAQ questions/answers in initial HTML and JSON-LD use exactly one backend implementation. After React mounts, it reuses those initial schema questions and refreshes from `/api/public/stations/{slug}/faq` (approved stations only). No playlist, song titles or AI results are transmitted by this endpoint.
- Authenticated/eligible users may additionally see up to three **real already-authorized** recent playlist entries inside the playlist FAQ's personal UI panel; they are never rendered by the public SEO server or JSON-LD.
- Existing staging `noindex` remains intentional. The HTTPS host Nginx SEO location rules and header policies are **manual VPS operations** not applied by `ilumadev.sh`. Do not permit staging indexing during checker QA.

### SEO 2.1 verification
1. Test a page with JavaScript disabled: the SSR station facts and FAQ must be legible and visually styled, not a raw text list.
2. Test a page with JavaScript enabled and throttled network: first paint shows the same single iRadios brand cover; then React's 1.4 s splash transitions to the UI. No raw text flash, white frame or duplicated logos.
3. Open a station with category, today's shows, hosts, city and FM frequency: max five factual FAQs in visible UI and JSON-LD. Change a public show and verify refresh changes only the relevant answer.
4. Confirm no public GET request or source HTML includes private `/api/stations/:id/playlist` history, restricted AI songs or drafts. Without sign-in, the FAQ explains access; with a verified account, the playlist panel can show eligible recent tracks.
5. On desktop, playlist fills the height of the description+FAQ stack; on mobile, cards stack without clipping the playlist/player.
6. Recheck OG images, canonical, sitemap content-types, `llms.txt`, and staging `X-Robots-Tag: noindex, nofollow, noarchive`.


### LLMS 2.0 — complete dynamic knowledge directory

- The old hardcoded \`llms.txt\` selection (40 queried / 25 printed) is removed.
  All \`status=approved\` stations are included using a **bounded-memory Mongo cursor**
  (batch size 128, backpressure-aware HTTP streaming) in stable name/ID order.
- \`/llms.txt\`: compact full index — EVERY approved station's real name,
  description excerpt, genre, region/city and links to canonical HTML and Markdown.
- \`/llms-full.txt\`: full application knowledge plus EVERY approved station's
  detailed description, slogan, declared genres, region/city/prefecture/country,
  transmission, terrestrial frequency where relevant, public images, validated
  official links, weekly schedule/hosts/descriptions in Europe/Athens, and
  exactly the same up-to-five FAQ from \`seo2Core.stationSeo()\`.
- \`/llms/application.md\`: public application facts, listener features, broadcaster/
  agency entry points, privacy boundaries, schema and discovery URLs.
- \`/llms/stations/<slug>.md\`: station-specific detailed public Markdown.
  \`/llms/categories/<category>.md\` and \`/llms/regions/<region>.md\`:
  full collections of approved stations in that actual catalog scope.
- \`/llms/schema/application.jsonld\`: the same \`homeSeo(...).ld\` graph used
  on the canonical homepage (including its max-100 ItemList scope).
  \`/llms/schema/stations/<slug>.jsonld\`: the same \`stationSeo(...).ld\`
  graph used for the station's HTML, not an independently reconstructed schema.
- Non-approved stations return 404, previously published station slugs redirect
  to the current canonical Markdown/JSON-LD URL. Only explicitly projected
  public fields are fetched from MongoDB.
- **NEVER** publish raw audio stream URLs, broadcaster account IDs, emails,
  phone numbers, private 30-minute playlist, ACRCloud results, pendingEdits,
  billing or staging secrets. Do not interpret a published programme as actual
  proof that the show aired.
- Documents are dynamic with an HTTP public cache of 180 seconds and shared
  proxy max age of 300 seconds; updates require no manual export or cron job.
  Individual pages are generated from the current approved Station record.
- The main \`llms.txt\` / \`llms-full.txt\` use \`text/plain; charset=utf-8\`;
  individual \`.md\` documents use \`text/markdown; charset=utf-8\`; JSON-LD
  exports use \`application/ld+json; charset=utf-8\`.
- \`llms.txt\` is an optional AI discovery convention, **not** a Google indexing
  requirement or a guarantee that AI platforms will consume the files.

#### Host Nginx MUST be updated manually
The new \`ops/nginx-stage.conf\` includes exact \`/llms-full.txt\` and prefix
\`/llms/\` proxy locations targeting \`127.0.0.1:5511\`. After the application
is deployed via \`sudo ./ilumadev.sh\`, the VPS operator must take a timestamped
backup of the **actual running** host Nginx file, apply only the necessary LLMS
location rules to the HTTPS \`stage.iradios.gr\` server, and run
\`sudo nginx -t && sudo systemctl reload nginx\`. Git pushes, PR merges, and
\`ilumadev.sh\` **do not** modify host Nginx. Do not replace the full config
without comparing the running setup; protect API, media and Mailpit blocks.

Staging stays **noindex, nofollow, noarchive** even while URLs are publicly
fetchable for testing. Verify the active X-Robots-Tag is not \`index, follow\`.
The previously identified exact \`/sitemap.xml\` 404 override, if still present
in host Nginx, must be removed/replaced separately after backup.

#### Verification (after manual deployment and Nginx changes)
- \`curl -sSI https://stage.iradios.gr/llms.txt\`
- \`curl -sSI https://stage.iradios.gr/llms-full.txt\`
- \`curl -sSI https://stage.iradios.gr/llms/application.md\`
- \`curl -sSI https://stage.iradios.gr/llms/schema/application.jsonld\`
- Choose a real approved slug and test both
  \`/llms/stations/<slug>.md\` and \`/llms/schema/stations/<slug>.jsonld\`.
- Verify counts against \`Station.countDocuments({status:'approved'})\`
  and make sure the last station in stable sorted order occurs in
  \`llms.txt\` and \`llms-full.txt\`.
- Test changing a published description, schedule, category or station approval,
  allowing for HTTP cache expiry. Private playlists and pending/rejected
  records must never appear.


### SEO 2.2 — One continuous first-paint preloader (no black intro + second splash)

- The semantic SEO document renders the **same full iRadios splash** markup as
  React (one official logo, the ambient effect, waves, glow, tagline, equalizer).
  Critical CSS is inlined before Vite styles load to avoid a bare black first
  screen; the artwork and layout are designed to match the React stylesheet.
- The first painted HTML records `window.__irSeoSplashStart` using
  `performance.now()`. When React mounts, it does **not** render another splash
  on SEO routes: it adopts the existing `#ir-seo-bootstrap` element and
  schedules its single fade/removal against the **elapsed** 1400ms timeline.
- A late React mount fades the existing image over 250ms rather than restarting
  a second 1.4s animation. A frontend-only route still gets its normal one
  React preloader. No audio/navigation/requests are blocked by the splash.
- Without JavaScript, the HTML splash is hidden by default and real styled SEO
  station content remains visible. If React never loads, the 10-second
  watchdog removes the HTML splash and exposes that content rather than
  leaving the user stuck behind an overlay.
- Staging QA: test cold/full reload (homepage, station, genre, map) on both
  desktop and mobile, throttle JS network, verify one logo/visual splash with
  no black interlude, no reset at React mount, original artwork proportions,
  1.4-second target where loading is fast, and graceful late mount.
  Check no-JS SSR page, JS bundle failure fallback, reduced-motion, and that
  schema/FAQ/meta/sitemaps remain unchanged.
- Regression checks:
  `node --test frontend/src/utils/preloaderTimeline.test.mjs`,
  `node ops/check-preloader-branding.test.cjs`, and
  `node --test backend/tests/seo2Render.test.js`.

Changes are **staging GitHub source only** until manual
`cd /srv/iradios/staging/app && sudo ./ilumadev.sh`. Production remains untouched.
