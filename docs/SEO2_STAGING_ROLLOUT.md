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
