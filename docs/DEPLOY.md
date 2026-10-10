# Deploying Oruva Points live

Deploy the API first (you need its URL for the web app and X), then the web app.

## 0. Push to GitHub

```bash
cd ~/workspace/oruva-points
git init && git add -A && git commit -m "Oruva Points MVP"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/oruva-points.git
git push -u origin main
```

## 1. API → Railway (https://railway.app)

1. New Project → Deploy from GitHub repo → select `oruva-points`.
2. Railway detects the `Dockerfile` at the repo root automatically.
3. Add a **volume**: Service → Volumes → New Volume, mount path `/data`.
4. Set these variables (Service → Variables). Copy values from your local
   `apps/api/.env`, except the four marked PROD below:

   | Variable | Value |
   |----------|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | leave unset (Railway injects it) |
   | `WEB_URL` | `https://<your-vercel-app>.vercel.app` ← PROD (set after step 2, then redeploy) |
   | `SESSION_SECRET` | long random string (generate a fresh one, don't reuse dev) |
   | `DATABASE_PATH` | `/data/oruva.db` ← PROD |
   | `X_CLIENT_ID` / `X_CLIENT_SECRET` | from your X app |
   | `X_REDIRECT_URI` | `https://<railway-domain>/api/auth/x/callback` ← PROD |
   | `X_BEARER_TOKEN` | from your X app (optional until Basic tier) |
   | `X_ORUVA_USER_ID` / `X_FOUNDER_USER_ID` | numeric IDs (after Basic upgrade) |
   | `SOLANA_RPC_URL` | `https://api.devnet.solana.com` (devnet for now) |
   | `SOLANA_CLUSTER` | `devnet` |
   | `ORVA_MINT` | `2qSEecXVLY1H3DFyJ6SzQYuNyXvoV47F9NszbiVTjGgc` |
   | `ORVA_PER_EPOCH` | legacy (weekly claims replaced by seasons; harmless) |
   | `DISTRIBUTOR_SECRET_KEY` | founder wallet key (same as local) |
   | `TREASURY_WALLET` | optional |

5. Deploy. Note the public domain, e.g.
   `https://oruva-points-api.up.railway.app`.
6. Health check: `https://<railway-domain>/api/health` should return `{"ok":true,...}`.

## 2. Web → Vercel (https://vercel.com)

1. Add New → Project → Import the GitHub repo.
2. **Root Directory:** `apps/web` (important — it's a monorepo).
3. Framework preset: Vite. Build command / output dir are auto-detected.
4. Environment variables:
   - `VITE_API_URL` = `https://<railway-domain>` (no trailing slash)
   - `VITE_GOOGLE_MAPS_API_KEY` = optional (free OSM fallback is used otherwise)
   - `VITE_SOLANA_CLUSTER` = `devnet`
5. Deploy. Note the URL, e.g. `https://oruva-points.vercel.app`.

## 3. Point the pieces at each other

1. **X app** (developer.x.com → your app → User authentication settings):
   - Callback URI: `https://<railway-domain>/api/auth/x/callback`
   - Website URL: `https://<vercel-app>.vercel.app`
2. **Railway:** set `WEB_URL` to the Vercel URL (triggers redeploy; required
   for CORS + post-login redirect).
3. Open the Vercel URL → "Connect with X" should round-trip back logged in.

## 4. Weekly epoch worker (cron)

The API doesn't finalize epochs by itself. Run this every Monday ~00:05 WAT:

```bash
npm run worker --workspace apps/api
```

Options: Railway's cron jobs, cron-job.org hitting a small endpoint (not
built — the worker is a script), or any always-on machine with the repo
checked out and `apps/api/.env` present.

## 5. Going to mainnet later

1. Repeat the token creation on mainnet-beta with a funded mainnet wallet.
2. Set `SOLANA_RPC_URL=https://api.mainnet-beta.solana.com`,
   `SOLANA_CLUSTER=mainnet-beta`, new `ORVA_MINT`, mainnet distributor key.
3. Frontend: set `VITE_SOLANA_CLUSTER=mainnet-beta` and redeploy.

## Troubleshooting

- **401 on every API call after login:** the session cookie needs
  `SameSite=None; Secure` cross-origin — already handled when
  `NODE_ENV=production`. If testing over plain HTTP, it won't stick.
- **CORS errors:** `WEB_URL` on the API must exactly match the frontend
  origin (scheme + host, no trailing slash).
- **Claim fails:** the distributor wallet needs SOL for fees (devnet:
  faucet.solana.com).
