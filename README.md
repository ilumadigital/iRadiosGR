# iRadios GR

**iRadios GR** is ILUMA Digital Agency's digital radio ecosystem for discovering and listening to Greek radio stations, managing broadcaster operations, supporting producers, running advertising campaigns, and administering premium radio services.

This repository contains the current application baseline imported from the production snapshot dated **2026-09-15**. It is the starting point for controlled development and staging work. Production must be treated as read-only unless a deployment is explicitly approved.

## Product principles

The core listener journey is deliberately simple:

> **Find a station → press Play → listen immediately.**

The product should remain fast, mobile-first, audio-first, premium, easy to understand, commercially viable and reliable. Existing working behavior has priority over rewrites.

## Main product areas

### Listener experience

- Greek radio discovery and station browsing
- Station profiles and public station URLs
- Browse by region, city and genre
- Interactive radio map
- Instant audio playback and fast station switching
- Favorites
- Now Playing / stream metadata
- Cover-art lookup and fallbacks
- Live Music Radar / track recognition integration
- Mood/discovery experiences
- Mobile navigation and mini-player
- Car Mode
- Media Session / hardware-media controls
- Web Audio DSP / EQ / normalization-oriented presets
- Notifications / Web Push
- Sharing and social-sharing flows
- PWA/app-like experience
- Embeddable radio widgets

### Premium listener experience

The codebase includes concepts and UI for premium listening, including removal of iRadios in-app advertising, advanced DSP / EQ controls, enhanced listening controls, Car Mode-related premium functionality, and Stripe-backed subscription lifecycle.

### Broadcaster platform

Broadcaster functionality includes broadcaster accounts, station ownership/submission, station profile/assets, approval/edit-request workflows, schedules and ON AIR information, station analytics, widgets, DSP/VU functionality, advertising controls, broadcaster premium plans, station boost and producer invitation/assignment flows.

### Producer platform

A dedicated `producer` role and Producer Studio are present. Producer permissions are distinct from broadcaster permissions and must be verified through station assignment/ownership relationships.

### Agency / advertising platform

The application includes agency accounts, audio ads, banner/visual ads, station/geographic targeting, campaign frequency/duration, approval states, impression/play/click counters, reporting, Stripe-supported payment flows and expiration handling.

### Administration

Admin areas include users, stations and approvals, ads, banners, payments/transactions, email operations, dashboard statistics and platform operations. Administrative capability must always be enforced server-side.

## Technology stack

### Frontend

React 19, React DOM 19, Vite 7, React Router, Tailwind CSS 4, Framer Motion, Lucide/React Icons, Leaflet/React Leaflet/React Simple Maps, Recharts, Socket.IO Client, Stripe React SDK, Cloudflare Turnstile integration and browser Media/Web Audio/Media Session APIs.

Primary source: `frontend/src`

### Backend

Node.js, Express 5, CommonJS, MongoDB/Mongoose, Socket.IO, JWT, bcrypt/bcryptjs, Axios, Multer, Stripe, Nodemailer, Web Push, node-cron, stream/Icecast metadata parsing and Canvas image generation.

Entry point: `backend/server.js`

### Data

Main MongoDB models: User, Station, Subscription (Web Push), Transaction, Ad, BannerAd, StationAnalytics and EmailHistory.

The production MongoDB dump is **not stored in Git** because it contains real operational/user data.

## Repository structure

```text
.
├── backend/              # Express/Mongoose/Socket.IO backend
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── .env.example
│   ├── Dockerfile
│   └── server.js
├── frontend/             # React/Vite listener + studio/admin application
│   ├── src/
│   ├── public/
│   ├── data/
│   ├── dist/
│   ├── .env.example
│   └── Dockerfile
├── uploads/              # persistent media snapshot supplied with baseline
├── docker-compose.yml
├── maruska.sh
├── maruskadump.sh
└── structure.txt
```

## Roles

| Role | Purpose |
|---|---|
| `admin` | Platform administration |
| `broadcaster` | Station owner / broadcaster tools |
| `producer` | Assigned producer/DJ workflows |
| `agency` | Advertising campaign workflows |
| `user` | Standard listener account |

Authorization should follow three layers: authenticated identity, role capability, and resource ownership/assignment.

## Audio architecture

Audio is mission-critical and should not be rewritten as part of unrelated work.

```text
Station record
  → stream URL
  → direct/proxied stream decision
  → HTML audio element
  → optional Web Audio DSP
  → metadata / artwork / recognition
  → Media Session
  → Socket.IO listener/session state
  → analytics / ad interactions
```

Before audio changes, test station switching, reconnect/stalled streams, Chrome, Safari/iOS, background playback, Bluetooth/media controls, Car Mode, metadata and ad recovery.

## Realtime

Socket.IO supports listener counts, device registration/playback transfer, listening sessions and live updates. Security-sensitive identity/room access must come from authenticated server state.

## Payments

Stripe supports listener/broadcaster subscriptions and advertising-related flows. The webhook endpoint relies on raw-body handling and signature verification, so middleware ordering is critical. Test subscription creation, webhooks, idempotency, transactions, entitlements, cancellation, expiration and failed-payment recovery before releases.

## Environment configuration

Real secrets are intentionally excluded from Git.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Populate values through the approved environment/secret store and never commit the resulting `.env` files. Current variable families include MongoDB, JWT, Stripe, SMTP, ACRCloud, VAPID, Turnstile and application URLs.

## Docker development baseline

The supplied architecture contains MongoDB, backend and frontend/nginx services. Typical baseline ports are frontend `5010`, backend `5011`, and MongoDB internal `27017`. In staging/development, MongoDB should remain private unless external access is explicitly required.

```bash
docker compose up --build
```

## Direct development

Backend:

```bash
cd backend
npm install
npm start
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Production-style frontend build:

```bash
npm run build
```

## Persistent uploads

`uploads/` contains real media/assets supplied with the baseline, including station artwork and advertising/audio media. Treat these files as business data. Development environments should use a separate upload area and must never clean/overwrite production uploads as part of normal development.

## Secrets and production data

The original snapshot contained production-like secret material and a separate MongoDB dump. This repository intentionally excludes raw `.env` values, production credentials/API secrets, the production MongoDB BSON dump, and backup logs that can contain operational information. `.env.example` contains variable names only. Credentials from the original snapshot should be rotated if still active.

## Current engineering status

This is an existing production application, not a greenfield rewrite. The 2026-09-15 read-only audit identified a required security/stability Phase 0 before broad feature work. Priority areas are server-side authorization/ownership, safe destructive/file operations, environment isolation, Stripe entitlement integrity, SSRF/proxy hardening, authenticated Socket.IO identity, admin/push protection, campaign/payment consistency, safe retention behavior and automated critical-path tests.

Development philosophy: **preserve → understand → improve → test → document → deploy safely**.

## Minimum smoke tests

- Listener: Home → discover → station → play → switch → pause/resume → volume → metadata → favorite.
- Account: register → verify/login → logout → password reset → profile.
- Broadcaster: login → studio → station → assets → schedule → analytics.
- Producer: login → Producer Studio → assigned station/functionality.
- Agency: login → campaigns → create/view ad → payment state → analytics.
- Admin: login → users → stations → ads → banners → transactions/payments.
- Payments: initiation → Stripe → webhook → transaction → entitlement update.

Audio playback, authentication and payments are critical-path tests.

## Change management

Recommended branch prefixes: `feature/...`, `fix/...`, `security/...`, `refactor/...`.

Every meaningful change should report **Changed**, **Files**, **Database**, **Environment**, **Risk**, **Testing** and **Rollback**. Database changes should be additive where possible and require backup/migration/validation/rollback analysis.

## Production safety

Production is read-only for development unless ILUMA explicitly authorizes deployment. Do not develop directly in the production VM, run untested migrations, delete production records, overwrite uploads, casually change DNS/SSL/Nginx, expose secrets, or use production as a test environment.

## Ownership

**iRadios GR** is developed and operated by **ILUMA Digital Agency**.

Public properties: `iradios.gr` and `play.iradios.gr`.

---

This repository is the controlled development foundation for the next iRadios GR iterations. Preserve working behavior first, especially playback, authentication, payments, public station URLs and externally embedded widgets.
