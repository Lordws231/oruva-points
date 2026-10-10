# ORVA Tokenomics v2 (DRAFT — 5% growth frame, for founder sign-off)

> ⚠️ **SUPERSEDED (Oct 10, 2026):** the founder confirmed the 30% engagement-rewards
> model instead — 300M ORVA over 3 themed seasons × 26 weeks (18 months),
> 100M ORVA per season, claims at season end with 14-day windows. See
> `docs/TOKENOMICS.md` (current) and `packages/shared/src/index.ts`
> (`ORVA_PER_SEASON`, `SEASONS`). This v2 draft is kept for reference only.

**Token:** Oruva Points (ORVA) · SPL token on Solana · 9 decimals
**Total supply:** 1,000,000,000 ORVA — fixed, no further minting
**Status:** draft v2 (Oct 10, 2026), rewritten to the founder's 5% growth-budget frame. Nothing here is final until signed off.

## What changed from v1

- The old draft put **30%** on engagement rewards and **15%** on referrals. Per the founder's frame, growth spend (onboarding + referrals + customer acquisition) is **5% total** — the engagement-farming pool *is* that 5%.
- Referrals are earned through farming tasks, so the separate 15% referral bucket is folded into the 5%.
- The freed supply moves to an **ecosystem reserve** (options below) — not silently absorbed.

## Allocation (proposed)

| Bucket | % | Amount | Purpose |
|--------|---|--------|---------|
| Growth budget — engagement farming | 5% | 50,000,000 | All epoch payouts: onboarding tasks, referrals, hashtag campaigns, location pins, engagement milestones. The *only* source of farming emissions. |
| In-app driver payments float | 25% | 250,000,000 | Riders pay drivers in ORVA; drivers hold, spend, or cash out. Settlement liquidity inside the Oruva app. |
| Promotions & marketing | 10% | 100,000,000 | Post-farming growth: launch campaigns, promo codes, transportation-integrated advertising partnerships. |
| Treasury / reserve | 10% | 100,000,000 | Strategic partnerships, exchange listings, unforeseen needs. Founder custody (multisig/hardware at mainnet). |
| Team & founders | 10% | 100,000,000 | Vesting schedule TBD before mainnet. |
| Ecosystem reserve (unallocated) | 40% | 400,000,000 | Parked. Options: future farming seasons beyond month 18, multi-chain expansion incentives, CEX/DEX liquidity, strategic grants — or burn. Founder decides. |

## Farming structure: weekly epochs inside themed seasons

- **Weekly epochs** (every Monday 00:00 WAT) are the accounting heartbeat — points tallied, pro-rata shares computed, claims open during the following epoch. This never changes.
- **Seasons** give the 12–18 month roadmap its narrative. Recommended: **4 seasons × 13 weeks ≈ 12 months**, each themed to the roadmap phase:
  1. *Testnet Trials* — testing the points site and claim flow (devnet)
  2. *Feedback Loop* — user feedback, task tuning, Osun field-testing
  3. *Growth Engine* — referral push, driver onboarding, acquisition
  4. *Scale & Mainnet* — mainnet ORVA, public launch, transportation-ad partners
- **The math:** 50,000,000 ÷ 52 weeks ≈ **~960,000 ORVA per weekly epoch** for a 12-month program. To stretch the same 5% across the full 18-month window, dial epochs to **~640,000 ORVA/week** (50M ÷ 78 weeks). The per-epoch amount is a governance dial, not a code change.

## How grading dispenses ORVA (unchanged mechanics)

- Points earned in epoch N are tallied at week's end; your share = your points ÷ total points in that epoch.
- You claim your share of the epoch's ORVA during epoch N+1 (verified in the Oct 10 devnet test: 4,500/6,000 points → 750,000 ORVA of a 1,000,000 pool).
- The "grading" is the task point table: follows 2,000 · location pins 1,500 (max 10/day) · hashtag posts 100 · engagement milestones 100–300.
- **Unclaimed ORVA:** recommended → returns to the growth budget (extends the program); alternative → treasury. Founder decides.

## Multi-chain posture

- All scoring, epochs, seasons, and points live **off-chain** — chain-agnostic by design.
- Only the final claim step touches Solana. Adding another chain later = adding a claim adapter; no re-architecture.
- Solana at launch; other chains are a phase-2 build, matching the fiat + multi-blockchain vision.

## Open decisions (founder to confirm)

1. Ecosystem reserve (40%): pick an option — future seasons, chain-expansion incentives, liquidity, grants, burn, or a split.
2. Season shape: 4 × 13 weeks (12 months, ~960k/week) vs 3 longer seasons (18 months, ~640k/week).
3. Unclaimed payouts: back to the growth budget (recommended) or to treasury.
4. Team/founder vesting schedule (cliff + duration) before mainnet.
5. Driver cash-out mechanics (in-app swap, off-ramp partner, hold-only).
6. Confirm the per-epoch dial for Season 1 (devnet testing can run lean, e.g. 100k/week, to conserve the 50M).

---

# Deck slide copy: ORVA Tokenomics (one slide)

**Title:** ORVA — the token that pays for growth

- **Supply:** 1B ORVA fixed, SPL on Solana (multi-chain claim adapters planned — points engine is chain-agnostic)
- **Growth budget 5% (50M):** engagement farming — users earn ORVA for follows, referrals, hashtag campaigns, live location pins; weekly epochs, pro-rata payouts, ~12 months of runway at ~960k/week
- **Driver economy 25% (250M):** riders pay drivers in ORVA; drivers hold, spend, or cash out to USDT/USDC/eNaira/fiat
- **Go-to-market 10% (100M)** · **Treasury 10% (100M)** · **Team 10% (100M, vesting)** · **Ecosystem reserve 40% (400M)**
- **Why it works:** every naira of growth spend is user acquisition with a receipt — points are earned by verifiable actions (rides, referrals, pins), and unclaimed rewards recycle back into the program
