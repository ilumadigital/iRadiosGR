# iRadiosGR — Smart NowPlaying and manual-only SonoVault

## Current behavior

All existing UI and metadata contracts remain intact. The browser, mobile,
desktop fullscreen and lock-screen media-session formatting are not redesigned.
Native station-supplied music metadata is scanned **without any paid recognition
calls** and stored in the shared station database.

Only an authenticated listener actively clicking **Βρες το τραγούδι** invokes
the provider. The backend captures a bounded audio sample from the approved
MongoDB station stream, uploads raw bytes once to SonoVault's
`/v1/tracks/identify`, transforms the response into the existing
`status + metadata.music` iRadios format, and publishes a real matched
artist/title to MongoDB.

The shared station playlist returns songs from the **last 30 minutes** to all
signed-in listeners. The manually recognized song remains a **four-minute**
priority in the current Now Playing snapshot (existing UX), while its playlist
entry remains visible for 30 minutes. A newer manual recognition replaces the
previous current song. Native metadata and the DJ/show image/RDS treatment
continue to follow their existing logic.

The UI's legacy `source: "acrcloud"` value identifies AI-sourced content for
the **Found with AI** badge and `{Station} - iRadios AI` album title. It no
longer identifies the upstream provider. Changing that internal enum would
break existing clients; do not change it when switching vendors.

The previous automatic ACRCloud/Top-5 scheduling logic is removed from server
startup. Listening heartbeats are passive and cannot trigger paid recognition.
Successful manual requests share a single in-flight call per station within
one backend instance. Existing limits remain 3 provider attempts and 6
captures per listener per 15 minutes.

See `ops/METADATA_SONOVAULT_STAGE.md` for server-only .env, deployment,
costs and real-device smoke checks.
