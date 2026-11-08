# Phase 4 — iRadiosGR Business Console (staging QA)

## Scope

Standalone player-free business area for Admin, Broadcaster and Producer in the official iRadios black/neon-lime aesthetic. It borrows useful broadcaster-portal information architecture (stations, edits, schedules, analytics) from the supplied TuneIn examples without copying TuneIn branding.

**No listener audio element, Media Session hook, radio playback engine, ad engine or public listener shell is mounted on /backoffice routes.**

## Direct URLs / backlinks

| Screen | URL |
|---|---|
| Dashboard | https://stage.iradios.gr/backoffice |
| Station directory | https://stage.iradios.gr/backoffice/stations |
| Create a station | https://stage.iradios.gr/backoffice/stations/new |
| Edit station | https://stage.iradios.gr/backoffice/stations/STATION_OBJECT_ID/edit |
| Weekly schedules | https://stage.iradios.gr/backoffice/schedules |
| Broadcaster insights | https://stage.iradios.gr/backoffice/insights |
| Broadcaster producers / team | https://stage.iradios.gr/backoffice/team |
| Admin approvals | https://stage.iradios.gr/backoffice/review |
| Analytics | https://stage.iradios.gr/backoffice/admin/analytics |
| Users | https://stage.iradios.gr/backoffice/admin/users |
| Audio ads | https://stage.iradios.gr/backoffice/admin/ads |
| Banners | https://stage.iradios.gr/backoffice/admin/banners |
| Home slides | https://stage.iradios.gr/backoffice/admin/slides |
| Radio Set | https://stage.iradios.gr/backoffice/admin/radioset |
| Billing (legacy Stripe until separate Nexi phase) | https://stage.iradios.gr/backoffice/admin/billing |
| Emails | https://stage.iradios.gr/backoffice/admin/emails |
| Public application | https://stage.iradios.gr/ |

An edit screen has Public profile, Copy link and return-to-stations navigation. Public station backlinks resolve to /station/{slug-or-id} using the current site origin.

## Roles and approval logic

- Admin: network-wide station listing, immediate approved edits, review/reject broadcaster pending edits, approve pending station submissions, any weekly programme, legacy admin tools within isolated shell.
- Broadcaster: only stations with matching broadcasterId derived from authenticated JWT, account station limit, pending directory/stream/social/logo/cover changes, own weekly programme.
- Broadcaster team: can invite Producers for an owned, approved station, view their assigned roles, and revoke access. Invitations are 7-day signed JWTs, accepted once through a rate-limited guest endpoint. **Staging captures invitations in internal Mailpit and does not send real emails.**
- Producer: only assigned station, weekly programme edit; not allowed to edit a station profile, create new radios or review changes.
- Guests, listeners and agencies: no backoffice API access.
- Legal: current-version Broadcaster terms required; an already accepted current version is not requested repeatedly.

All backoffice APIs use /api/backoffice, JWT protect + role checks, resource ownership, private no-store responses and strict editable-field allowlists. New stations are pending. Image uploads accept PNG/JPG/WEBP with signatures and max 3 MB, in random filenames under station-specific public image directories.

## Staging deployment

After approved PR + green CI and merge to staging, from the Hostinger staging VPS:

    cd /srv/iradios/staging/app
    sudo ./ilumadev.sh

Sign in via /login. Admin/Broadcaster/Producer login automatically opens /backoffice. No production deploy or changes to production secrets.

## Manual QA checklist

- [ ] Anonymous GET /api/backoffice/overview returns HTTP 401.
- [ ] Listener / agency JWT returns 403; Admin, Broadcaster and Producer load only their roles.
- [ ] Broadcaster without current terms redirects to the Terms screen; prior valid consent is remembered.
- [ ] Broadcaster can only edit owned stations; changes remain pending before Admin Review.
- [ ] Admin approve publishes changes; reject clears pending changes.
- [ ] New broadcaster station remains pending, subject to max station count.
- [ ] Producer cannot edit station profile or another station's schedule.
- [ ] Broadcaster can invite/revoke a Producer. Stage email stays in Mailpit only; the one-use invite link sets a password and its replay fails.
- [ ] Weekly schedule accepts valid days/hours and rejects overlaps.
- [ ] Logo/cover uploads work in browser and the public Nginx radioassets path.
- [ ] Admin legacy analytics, users, ads, banners, slides, emails and billing load without player.
- [ ] Responsive visual check at mobile/tablet/desktop, keyboard focus, error and empty states.
- [ ] Public station profile and Back to stations links work.
- [ ] Run node ops/check-phase4-backoffice.cjs, public-stage security checks and full GitHub CI.

## Deferred

Legacy admin tools are lazy-loaded inside the new branded shell; their individual forms have not been entirely rebuilt. Nexi replaces Stripe in a separate phase. Image optimization, station-list pagination at scale and final production security approval remain future tasks. CI is offline and does not replace staging tests with real credentials and asset paths.
