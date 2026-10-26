# Oruva Points

Engagement-points website for **Oruva Transportation Services**, modeled on the
[tipcoin.io](https://thetipcoin.io) SocialFi MVP: **off-chain engagement
scoring + weekly epochs + on-chain token claims** — but claims settle on
**Solana** (SPL token `ORVA`) instead of Ethereum.

Users connect with X, complete tasks (follow @Oruvatransport on X,
Instagram, Threads and Facebook, join the Discord server, follow the
founder on X/LinkedIn, post on X with the campaign hashtags, share live area
location pinpoints), earn points in weekly epochs across three 26-week
seasons, then claim a pro-rata share of 100,000,000 ORVA per season at each
season's end.

## Monorepo

```
oruva-points/
  packages/shared/   pure TS: task defs, point values, epoch math (Africa/Lagos), geo helpers
  apps/api/          Express + TS + node:sqlite — auth, tasks, pins, epochs, Solana claims
  apps/web/          Vite + React + TS + Tailwind v4 — landing, tasks, leaderboard, claim
  docs/ARCHITECTURE.md  design mapped to the tipcoin MVP
```

## Quick start

```bash
cd ~/workspace/oruva-points
npm install --no-audit --no-fund        # ONE install at root (npm workspaces)

# configure
cp .env.example apps/api/.env          # then fill in values (see below)
cp .env.example apps/web/.env          # then fill in values

# run (two terminals)
npm run dev --workspace apps/api       # → http://localhost:8787
npm run dev --workspace apps/web       # → http://localhost:5173

# build
npm run build --workspaces             # builds shared → api → web
```

| App | Dev command | Port |
|-----|-------------|------|
| `apps/api` | `npm run dev --workspace apps/api` (tsx watch) | 8787 |
| `apps/web` | `npm run dev --workspace apps/web` (vite) | 5173 (`VITE_API_URL` → `http://localhost:8787`) |

Epoch finalization worker (run weekly via cron, ~00:05 WAT Monday):

```bash
npm run worker --workspace apps/api
# cron: 5 0 * * 1 cd ~/workspace/oruva-points && npm run worker --workspace apps/api
```

Create the ORVA token (once, per cluster):

```bash
npm run token:create --workspace apps/api   # needs DISTRIBUTOR_SECRET_KEY + SOL for fees
```

## Environment variables

Copy `.env.example` → `apps/api/.env` and `apps/web/.env`.

| Var | Where | Required | Notes |
|-----|-------|----------|-------|
| `SESSION_SECRET` | api | yes | long random string; signs session cookies (HMAC-SHA256) |
| `DATABASE_PATH` | api | no | default `./data/oruva.db` |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` / `X_REDIRECT_URI` | api | yes for login | X developer app with OAuth 2.0 enabled |
| `X_BEARER_TOKEN` | api | no | app bearer token; without it follow checks degrade to self-attestation |
| `X_ORUVA_USER_ID` / `X_FOUNDER_USER_ID` | api | no | numeric IDs of @Oruvatransport / @AbiodunOyaniyi |
| `SOLANA_RPC_URL` / `SOLANA_CLUSTER` | api, web | no | defaults: devnet |
| `ORVA_MINT` | api | yes for claims | printed by `token:create` |
| `ORVA_PER_EPOCH` | api | no | legacy (weekly claim model); payouts now use 100,000,000 ORVA per season |
| `DISTRIBUTOR_SECRET_KEY` | api | yes for claims/token | base58 secret key — **keep secret** |
| `TREASURY_WALLET` | api | no | receives unclaimed allocations after claim windows close |
| `VITE_API_URL` | web | no | default `http://localhost:8787` |
| `VITE_GOOGLE_MAPS_API_KEY` | web | no | optional; when set, the location picker uses Google Maps, otherwise it uses the built-in free OpenStreetMap (Leaflet) fallback — no key or billing needed |

### Resolving numeric X user IDs

```bash
curl -H "Authorization: Bearer $X_BEARER_TOKEN" \
  https://api.twitter.com/2/users/by/username/Oruvatransport
# → {"data":{"id":"<numeric>","name":"...","username":"Oruvatransport"}}
```

Put the returned `id` values into `X_ORUVA_USER_ID` and `X_FOUNDER_USER_ID`.

## Point rules (exact)

| Task | Points | Rule |
|------|--------|------|
| Follow @Oruvatransport on X | 1,000 | one-time |
| Follow founder @AbiodunOyaniyi on X | 1,000 | one-time |
| Follow founder on LinkedIn | 1,000 | one-time |
| Follow Oruva Transportation Services on LinkedIn | 1,000 | one-time |
| Follow @oruvatransportation on Instagram | 1,000 | one-time |
| Follow @oruvatransportation on Threads | 1,000 | one-time |
| Follow Oruva Transportation Services on Facebook | 1,000 | one-time |
| Join the Oruva Discord server | 1,000 | one-time |
| Post on X with campaign hashtags | 100 | repeatable; no daily limit; post must include a campaign hashtag; each tweet claimable once |
| Share live area location pinpoint | 1,500 each | repeatable; ≤10/day; ≥100 m from previous pin |
| **Engagement milestones — verified X accounts** |||
| 100+ retweets & over 100 likes | 250 | per own post; Basic-tier X API required; each milestone claimable once per post |
| 100+ quotes & over 100 likes | 300 | per own post; Basic-tier X API required; each milestone claimable once per post |
| Over 500 likes | 200 | per own post; Basic-tier X API required; each milestone claimable once per post |
| Over 100 replies | 200 | per own post; Basic-tier X API required; each milestone claimable once per post |
| **Engagement milestones — unverified X accounts** |||
| 50+ retweets & 50+ likes | 150 | per own post; Basic-tier X API required; each milestone claimable once per post |
| 50+ quotes | 150 | per own post; Basic-tier X API required; each milestone claimable once per post |
| 100+ likes | 150 | per own post; Basic-tier X API required; each milestone claimable once per post |
| 50+ replies | 100 | per own post; Basic-tier X API required; each milestone claimable once per post |

## Seasons & claims

- The 18-month engagement farming program runs in **3 seasons of 26 weekly
  epochs** (Monday 00:00 → Monday 00:00 **Africa/Lagos**), starting
  2026-10-26: Season 1 "Ignition" (user testing, months 1–6), Season 2
  "Refinement" (feedback, months 7–12), Season 3 "Acceleration" (growth,
  months 13–18).
- Points accrue per weekly epoch exactly as before; a user's **season score**
  is the sum of their points across the season's 26 weeks.
- Claims open at **season end**: `tokens = floor(userSeasonPoints /
  totalSeasonPoints × 100,000,000)` — one claim per user per season, paid as
  ORVA SPL tokens to the connected Solana wallet.
- Claim window = **14 days** after season end. Unclaimed allocation returns to
  the treasury wallet after the window closes.

## What's stubbed / degraded

- **X follow verification**: real check via `GET /2/users/:id/following` when
  `X_BEARER_TOKEN` works. Free-tier X API usually lacks `follows.read`, so the
  API degrades to **self-attestation** (`verified=false`, noted in the
  response) so the campaign isn't blocked. Re-verify later via the API.
- **Engagement milestones**: `POST /api/tasks/engagement/complete` requires
  `X_BEARER_TOKEN` (X API Basic tier or higher). Without working API access it
  returns **503** and awards **nothing** — engagement metrics cannot be
  self-attested (unlike follows/hashtags). The claimant's tier (verified vs
  unverified X account) is stored at login and refreshed on every sign-in;
  a NULL status is treated as unverified. Each milestone is claimable once
  per post (ledger key `<TASK_ID>:<tweetId>`); unlimited posts per day.
- **Hashtag-post verification**: when `X_BEARER_TOKEN` works, the tweet is
  fetched via `GET /2/tweets/:id` and must be authored by the claiming user
  with a campaign hashtag in the text (`verified=true`). Without the token
  it degrades to self-attestation (`verified=false`); dedupe (one claim per
  tweet) always applies, and there is no daily cap.
- **Instagram / Threads / Facebook / LinkedIn follows**: verified by the
  social verification bot before any points are awarded — see
  `docs/VERIFICATION_BOT.md`. Instagram and Threads use follower-snapshot
  + bio-code bot checks; Facebook uses a live Graph API `user_likes`
  check against the user's connected account; LinkedIn uses a pending
  code queue verified against the founder's own follower list (LinkedIn
  offers no individual-follow API). No verification, no points.
- **Discord**: no public join-verification API exists — still
  self-attestation (`{confirm:true}`).
- **Geocoding**: the `city` label on pins is user-supplied free text; no
  reverse-geocoding is performed server-side.
- **PKCE store**: in-memory (single instance). Use Redis/shared store for
  multi-instance deploys.
- **Token metadata** (name/symbol on-chain via Metaplex) is not set by
  `create-token.ts` — add it with your preferred tooling if desired.

## What you must supply before going live

1. **X developer app** credentials (`X_CLIENT_ID`, `X_CLIENT_SECRET`,
   `X_REDIRECT_URI`) with OAuth 2.0 enabled; `X_BEARER_TOKEN` + numeric user
   IDs for real follow/hashtag verification (required for engagement
   milestones — Basic tier or higher).
2. **Google Maps API key** (optional) — the location picker works out of
   the box with the free OpenStreetMap fallback; set
   `VITE_GOOGLE_MAPS_API_KEY` only if you prefer Google Maps.
3. **Solana distributor wallet**: generate a keypair, fund with SOL (devnet or
   mainnet), run `npm run token:create --workspace apps/api`, set `ORVA_MINT`,
   keep `DISTRIBUTOR_SECRET_KEY` secret (use a vault in production).
4. **`SESSION_SECRET`** — a long random string.
5. Production: HTTPS origins for `X_REDIRECT_URI`/`WEB_URL`, secure cookies
   (automatic when `NODE_ENV=production`), and a weekly cron for the worker.
