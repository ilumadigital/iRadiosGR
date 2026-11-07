FROM node:22-bookworm
WORKDIR /app
ENV NODE_ENV=production
# canvas@2 native addon requires Cairo/Pango. Compatibility must be tested.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config libcairo2-dev libpango1.0-dev libjpeg-dev \
    libgif-dev librsvg2-dev && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
# Original source lockfile is out of sync (canvas missing); npm ci will be adopted after lock repair.
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
ARG IRADIOS_SITE_ORIGIN
RUN IRADIOS_SITE_ORIGIN="$IRADIOS_SITE_ORIGIN" node scripts/apply-site-origin.cjs
EXPOSE 5011
CMD ["node", "server.js"]
