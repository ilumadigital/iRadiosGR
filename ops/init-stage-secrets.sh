#!/usr/bin/env bash
set -euo pipefail
[[ "$(id -u)" == "0" ]] || { echo 'Run as root via sudo'; exit 1; }
install -d -o root -g root -m 700 /etc/iradios/staging
if [[ -e /etc/iradios/staging/compose.env || -e /etc/iradios/staging/backend.env ]]; then
  echo 'Existing secret file found; refusing to overwrite.' >&2
  exit 1
fi
stage_mongo_password=$(openssl rand -hex 32)
stage_jwt_secret=$(openssl rand -hex 48)
# Generate distinct stage VAPID pair, not production VAPID keys.
key_pair=$(docker run --rm node:22-bookworm node -e 'const k=require("crypto").createECDH("prime256v1");k.generateKeys();console.log(k.getPublicKey().toString("base64url")+":"+k.getPrivateKey().toString("base64url"))')
public_key=${key_pair%%:*}
private_key=${key_pair#*:}
umask 077
printf 'STAGE_MONGO_PASSWORD=%s\n' "$stage_mongo_password" > /etc/iradios/staging/compose.env
cat > /etc/iradios/staging/backend.env <<EOF
APP_ENV=staging
NODE_ENV=production
PORT=5011
FRONTEND_URL=https://stage.iradios.gr
JWT_SECRET=$stage_jwt_secret
STRIPE_SECRET_KEY=sk_test_disabled_no_payments
STRIPE_WEBHOOK_SECRET=whsec_disabled
SMTP_HOST=mailpit
SMTP_PORT=1025
MAIL_FROM=staging@invalid.example
ADMIN_EMAIL=staging@invalid.example
VAPID_PUBLIC_KEY=$public_key
VAPID_PRIVATE_KEY=$private_key
EOF
chmod 600 /etc/iradios/staging/{compose.env,backend.env}
echo 'Created stage-only credentials (not printed). Store encrypted off-server backup.'
