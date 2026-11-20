#!/usr/bin/env bash
# Convenience wrapper; distinct from staging ./ilumadev.sh.
set -Eeuo pipefail
[[ "$#" -eq 0 ]] || { echo "Usage: sudo bash ./ilumaprod.sh" >&2; exit 2; }
cd /srv/iradios/production/app
exec bash ops/deploy-prod.sh
