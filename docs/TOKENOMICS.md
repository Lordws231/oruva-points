# ORVA Tokenomics (DRAFT — for founder review)

**Token:** Oruva Points (ORVA) · SPL token on Solana · 9 decimals
**Total supply:** 1,000,000,000 ORVA — fixed, no further minting
**Status:** draft allocation plan (Oct 2026). Percentages are adjustable before the mainnet launch.

## Allocation

| Bucket | % | Amount | Purpose |
|--------|---|--------|---------|
| Engagement rewards pool | 30% | 300,000,000 | Points-website season payouts: 100,000,000 ORVA per season across 3 themed seasons of 26 weeks each (18-month program). Claims open at each season's end with a 14-day window; one claim per user per season. |
| In-app driver payments float | 25% | 250,000,000 | Riders pay drivers in ORVA; drivers can hold, spend, or cash out. Provides settlement liquidity inside the Oruva app. |
| Referral rewards | 15% | 150,000,000 | Users earn ORVA for referring riders and drivers. |
| Promotions & marketing | 10% | 100,000,000 | Launch campaigns, promo codes, transportation-integrated advertising partnerships. |
| Treasury / reserve | 10% | 100,000,000 | Strategic partnerships, exchange listings, unforeseen needs. Held in founder custody. |
| Team & founders | 10% | 100,000,000 | Vested over 2–4 years (vesting schedule TBD before mainnet). |

## Design notes

- **Utility-first:** ORVA is earned (engagement, referrals, promotions, driving) and spent (paying for rides) inside the Oruva ecosystem — demand grows with app usage.
- **Operational setup at mainnet:** each bucket lives in its own wallet; only the engagement-rewards float and driver-payments float sit in hot wallets, the rest in founder custody (ideally a multisig or hardware wallet).
- **Season payouts** draw only from the engagement rewards pool; when a season's
  allocation is set, it is fixed at 100,000,000 ORVA — never by minting more.
- **Devnet:** the current devnet token is a single-holder test deployment; the bucket split is applied at mainnet launch.

## Open decisions (founder to confirm)

1. Final percentages per bucket.
2. Team/founder vesting schedule (cliff + duration).
3. Whether unclaimed season payouts return to the engagement pool or the treasury.
4. Driver cash-out mechanics (in-app swap, off-ramp partner, or hold-only).
