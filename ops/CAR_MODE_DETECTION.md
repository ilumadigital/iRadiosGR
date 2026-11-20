# Car Mode — fail-closed automatic detection policy (iRadiosGR)

The listener's **manual** Car Mode button is not removed and keeps its existing premium/entitlement rules. This change only affects the automatic prompt; it cannot silently enable Car Mode.

## Why the old prompt was incorrect

The old CarModePrompt used geolocation speed, mobile landscape, User-Agent strings (including "car" / "automotive"), and generic audio-device labels (Bluetooth, Sony, JBL, Bose and similar). These could trigger a driving popup on desktop, in a train/bus, or when using normal Bluetooth headphones.

None of these are acceptable signals. The new prompt has **no geolocation permission** and **no audio capture permission** requests.

## Conditions for an automatic popup

All of the following must be true:
- Listener Premium is active (existing policy).
- The client is clearly an iPhone/iPod or Android phone, never desktop, tablet, TV or unknown.
- This browser session has not dismissed the prompt.
- A **confirmed** car connection is available through one of two narrow signals:

  1. Future native integration: \`window.iRadiosCarAudioBridge.getConnectionState()\` returns \`{connected: true, kind: 'carplay' | 'android_auto' | 'car_bluetooth'}\`. Additional recognized aliases live in \`CAR_CONNECTION_TYPES\`. The native host **must** check an active car connection before asserting \`connected:true\`, and dispatch a \`window\` event named \`iradios:car-audio-change\` after connection changes. This object is a **contract for a native wrapper**, not evidence that a native CarPlay/Android Auto wrapper currently exists.
  2. Limited web compatibility: the actual iRadios audio element has a **non-default** selected \`sinkId\` that matches the \`deviceId\` of a recognized car-specific \`audiooutput\` in \`navigator.mediaDevices.enumerateDevices()\`. Generic brands, unselected/available devices, \`audioinput\`, the \`default\` sink and unknown labels never qualify.

A mobile browser/PWA typically **cannot** read the OS system's active Bluetooth audio route, Apple CarPlay attachment or Android Auto attachment. It therefore **cannot promise automatic detection** for those routes. An unknown route intentionally shows **no** modal, not a guessed modal. Do not replace this behavior with GPS/UA/landscape heuristics. The manual Car Mode control remains available.

This client-side connection signal controls UX only; it is **not** an authentication, entitlement, billing or device-trust source.

## UX copy (exact)

**Οδήγηση και κινητό, δεν πάνε μαζί!**

Βάλε τη λειτουργία οδήγησης και έχε τα μάτια σου στο δρόμο! Καλή Διαδρομή!

Primary CTA: **Ενεργοποίηση Car Mode**. Secondary action: **Όχι τώρα**.

## CI / QA

\`\`\`bash
node --test frontend/src/utils/carAudioDetection.test.js ops/check-car-mode-confirmed-detection.test.cjs
npm --prefix frontend run build
\`\`\`

Manual staging QA: Windows/Mac PC with Bluetooth headset, mobile AirPods, mobile with no output permissions, mobile on landscape, high GPS speed, native bridge connection/disconnection, explicitly selected car audio sink, session dismissal, premium gating and manual Car Mode.

Merge does not deploy to the VPS. Deploy staging manually with:

\`\`\`bash
cd /srv/iradios/staging/app && sudo ./ilumadev.sh
\`\`\`
