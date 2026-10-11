# API production image — build from the REPO ROOT (Railway/Render/Fly).
# Railway: leave Root Directory at the repo root; it will pick up this Dockerfile.
FROM node:22-alpine

WORKDIR /app

# Install workspace dependencies (root + shared + api manifests)
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN npm ci --workspace apps-api --include-workspace-root --no-audit --no-fund

# Copy sources and build (workspace tsconfigs extend the root base config)
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npm run build --workspace @oruva/shared && npm run build --workspace apps-api

# ---- runtime ----
ENV NODE_ENV=production
# Railway injects PORT automatically (config falls back to 8787).
# Attach a persistent volume at /data and set DATABASE_PATH=/data/oruva.db
# so the SQLite database survives restarts/redeploys.
EXPOSE 8787
CMD ["node", "apps/api/dist/src/index.js"]
