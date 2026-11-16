# iRadiosGR — Athens time and human-readable dates

Policy for listener, Broadcaster, Agency and Admin UI (staging first).

* Displayed calendar dates: **DD/MM/YYYY** (e.g. 16/11/2026).
* Displayed date/time: **DD/MM/YYYY HH:mm** (24-hour, Athens).
* Time only: **HH:mm** (Athens).
* On-screen date inputs: GreekDateInput accepts the same day-first notation and produces strict ISO yyyy-MM-dd / yyyy-MM-ddTHH:mm application field values.
* A wall-clock yyyy-MM-ddTHH:mm is converted to a UTC instant with athensWallTimeToIso() before campaign/slide/creative scheduling. A nonexistent spring DST hour is rejected; ambiguous autumn hour picks the earlier occurrence.
* Server API timestamps, MongoDB Date/BSON, transaction timestamps, signed tickets, ledgers and payment webhooks **remain in ISO/UTC**. Do not store localized strings in the database or modify historical timestamps.

## Hostinger VPS operator-only command

This changes the **host's** timezone and can affect other programs on the same VPS, including their log formatting or cron defaults. Schedule and verify this change with awareness of other services. The repository/CI does not execute this privileged host action.

    sudo timedatectl set-timezone Europe/Athens
    timedatectl
    date '+%d/%m/%Y %H:%M:%S %Z'

No reboot is required. The staging Node container explicitly declares TZ=Europe/Athens in compose.stage.yml; do not change the MongoDB container's UTC timestamps. Restart/recreate the backend through the existing deployment process after merging:

    cd /srv/iradios/staging/app && sudo ./ilumadev.sh

The above Git push/merge does **not** deploy the staging VPS. Keep Gateway Sandbox and Mailpit unchanged.

## Acceptance tests

    node --test frontend/src/utils/dateTime.test.js backend/tests/athensDateTime.test.js ops/check-athens-date-format.test.cjs

Post-deploy manual checks: DST boundary (29/03/2026 and 25/10/2026), first/last day of campaign, monthly subscription expiry, billing history, news timestamps, mobile signup/profile birthday, Admin complimentary grant date, Agency wizard quote date and Admin slideshow scheduling. Verify UTC API/DB payloads and billing idempotency remain unchanged.
