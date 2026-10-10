# Architecture — Oruva Points

How this codebase maps to the tipcoin.io SocialFi MVP, and where it differs.

## The tipcoin pattern (recap)

Tipcoin's MVP is **off-chain engagement scoring + on-chain claims**:

1. **Off-chain heavy** — Twitter/X ingestion, a points rules engine, and a
   per-epoch ledger live in a normal backend + database. The chain is only
   touched for the final token distribution.
2. **Epoch service** — weekly job finalizes points for epoch N; Oruva groups
   26 weekly epochs into a season, allocation is each user's pro-rata share
   of the season's 100,000,000 ORVA pool; claims open at season end with a
   14-day window; unclaimed tokens return to treasury.
3. **Claim layer** — an ERC-20 + distributor contract verifies eligibility
   (X-linked wallet + allocation) and pays out.
4. **Sybil defenses** — daily limits, quality signals, claim windows.

## Oruva Points mapping

| Tipcoin piece | Oruva implementation | File |
|---|---|---|
| X ingestion / scoring | Task-based scoring instead of tweet-engagement mining: follow tasks + location pins, each awarding fixed points into a single ledger | `apps/api/src/routes/tasks.ts`, `routes/location.ts`, `db.ts` (`tasks_completed`) |
| Points rules engine | Pure functions in shared package: task defs, point values, pin rules (100 m haversine dedupe, 10/day cap) | `packages/shared/src/index.ts` |
| Epoch service | Weekly cron worker: snapshots `total_points`, marks epoch finalized | `apps/api/src/worker.ts` |
| Epoch math | Monday 00:00 Africa/Lagos week math; 3 seasons × 26 weeks (18-month program), per-season claim windows | `packages/shared/src/index.ts` |
| Claim layer (ERC-20 → **SPL**) | Distributor wallet transfers ORVA from its ATA to the user's ATA (created on demand); idempotent `claims` table keyed `SEASON:<id>` (one claim per user per season) | `apps/api/src/solana.ts`, `routes/claim.ts` |
| Tokenomics | Fixed 1,000,000,000 supply minted once to distributor; 100,000,000 ORVA/season (`ORVA_PER_SEASON`, 30% of supply); pro-rata `floor(share × pool)`; unclaimed → treasury (configurable, not burned — see below) | `apps/api/scripts/create-token.ts` |
| Sybil defenses | One-time tasks idempotent per user; pin distance + daily caps; X OAuth identity (one X account = one user); claim windows | `db.ts`, `routes/*` |
| Dashboard / stats | Landing + tasks + leaderboard + claim pages | `apps/web/src/pages/*` |

## Key design decisions & differences from tipcoin

- **Task-based, not tweet-mining.** Tipcoin mined `$tip` mentions via the X
  API. X API access tiers make that fragile; Oruva uses explicit,
  verifiable tasks (follows + GPS pins) which need no streaming pipeline.
- **Solana, not Ethereum.** Claims are simple SPL transfers from a
  distributor keypair — no claim contract, no Merkle proofs, negligible fees.
  Trade-off: the distributor key is a hot wallet; in production it should live
  in a vault/HSM and the API should sign via a signer service.
- **Unclaimed → treasury, not burn.** `TREASURY_WALLET` receives unclaimed
  allocation after each season's 14-day claim window (configurable; a burn address works too).
- **Follow verification degrades gracefully.** The X API free tier generally
  lacks `follows.read`, so `checkFollows()` falls back to self-attestation
  (`verified=false`) rather than blocking the campaign. Attested completions
  are flagged and can be re-verified by an admin job once API access exists.
- **LinkedIn is attestation-only** — LinkedIn offers no public
  follow-verification API.
- **SQLite via `node:sqlite`.** Single-file, zero-dependency persistence —
  right-sized for an MVP. Migrate to Postgres when running multi-instance.

## Data model

```
users(x_user_id PK, username, avatar, wallet_address, created_at)
tasks_completed(id, x_user_id, task_id, epoch, points, verified, note, created_at)
  -- single points ledger; pins write task_id='LOCATION_PIN:<pinId>'
location_pins(id, x_user_id, lat, lng, city, epoch, created_at)
epochs(id PK, starts_at, ends_at, finalized, total_points)
claims(x_user_id, epoch PK, points, tokens, tx_sig, claimed_at)
```

## Request flows

**Connect:** `GET /api/auth/x` → X OAuth 2.0 PKCE → callback exchanges code,
fetches profile, upserts user, sets HMAC-signed httpOnly cookie.

**Follow task:** `POST /api/tasks/:id/complete` → `checkFollows()` (or
attestation) → `awardOnce()` (idempotent) → points land in the epoch ledger.

**Pin:** `POST /api/location` → validate lat/lng → 10/day cap → 100 m
haversine dedupe vs last pin → `insertPin()` (pin + ledger row in one
transaction).

**Finalize (cron):** `worker.ts` → previous epoch → `total_points` snapshot →
`finalized=1`.

**Claim:** `GET /api/claim/quote?epoch=` → `POST /api/claim {epoch, wallet}` →
window check → `quoteClaim()` → `claimTokens()` (distributor → user ATA) →
`claims` row (PK prevents double-claim; in-memory lock prevents double-submit).

## Production hardening (not in MVP scope)

- Move `DISTRIBUTOR_SECRET_KEY` to a vault/HSM; consider a multisig treasury.
- Replace in-memory PKCE store + claim locks with Redis for multi-instance.
- Postgres + migrations; admin endpoints for epoch management and abuse review.
- Rate limiting on pin/task endpoints; device fingerprinting for sybil
  resistance beyond X OAuth.
- Token-2022 / Metaplex metadata for the ORVA mint (name/symbol on-chain).
