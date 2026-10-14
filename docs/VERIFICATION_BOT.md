# Social follow-verification bot

Points for the social follow tasks are awarded **only after verification**.
There is no self-attestation ("I followed ✓") path for these tasks — an
unverified, failed or unavailable check awards nothing.

| Task | Points | How the follow is verified before award |
|------|--------|------------------------------------------|
| Follow @Oruvatransport on Instagram | 1,000 | Bot follower snapshot + bio-code ownership (`routes/instagram.ts`, `workers/ig-worker.sh`) |
| Follow @Oruvatransport on Threads | 1,000 | Bot follower snapshot + bio-code ownership (`routes/social-verify.ts`, `workers/social-worker.sh`) |
| Follow @Oruvatransport on Facebook | 1,000 | Live Facebook Graph check with the user's own authorized token: `GET /me/likes/<FB_PAGE_ID>` (`facebook.ts`, `POST /api/social/facebook/verify`) |
| Follow founder on LinkedIn | 1,000 | Pending code queue, verified against the founder's own LinkedIn follower list + the code in the claimant's About section (`routes/social-verify.ts`, `workers/social-worker.sh linkedin-*`) |
| Follow Oruva Transportation Services on LinkedIn (company Page) | 1,000 | Same queue; the verdict is checked against the Page admin's follower list + the About-section code. The same LinkedIn profile may earn both LinkedIn tasks, but each task only once |

Discord join remains self-attested (out of scope for this bot), and X
follows keep their existing X API verification/degradation behaviour.

## Why each platform works the way it does

- **Instagram / Threads** — Meta's public APIs do not expose "does user X
  follow account Y", but the Oruva accounts' own follower lists are
  readable with the linked-account CLIs (`instagram-cli`, `threads-cli`).
  The bot snapshots those followers into the API; a claim starts only if
  the username is in the snapshot (it follows the page). A one-time
  `ORVA-XXXXXX` code placed in the claimant's bio then proves they own
  that username — the bot reads the bio and reports the verdict. A
  username can earn its task once, globally.
- **Facebook** — a Page cannot list its followers at all. The only
  reliable channel is the user's own authorization: with Facebook Login
  (`user_likes` permission) the API asks the Graph API whether the
  connected account likes/follows the Oruva Page, and awards only on a
  positive answer.
- **LinkedIn** — LinkedIn has no API to check whether an individual
  member follows a person or a Page: its follower endpoints return
  aggregate statistics to Page admins only, and profiles cannot be read
  by a bot. The anti-cheat guarantee is therefore enforced by process:
  claims sit in a pending queue with an ownership code, and points are
  created only when a verification result is submitted after the
  founder checks his own LinkedIn follower list (the authoritative
  source) and the code on the claimant's profile.

## API surface

User-facing (session auth):

- `POST /api/social/FOLLOW_THREADS/start` — body `{ username }`
- `POST /api/social/FOLLOW_FOUNDER_LINKEDIN/start` — body `{ profileUrl }`
- `POST /api/social/FOLLOW_ORUVA_LINKEDIN/start` — body `{ profileUrl }`
- `POST /api/social/:taskId/verify` — queue the bot check
- `GET  /api/social/:taskId/status` — `none|pending|checking|done|failed|expired`
- `POST /api/social/facebook/verify` — live Graph check → award on success
- `GET  /api/auth/facebook` + `/callback` — Facebook Login linking
  (extends the existing linked-accounts system)

Bot/admin (`x-admin-key: $ADMIN_KEY`, same key as the Instagram bot):

- `POST /api/social/admin/snapshot` — `{ provider, entries: [{username, providerUserId}] }`
- `GET  /api/social/admin/pending?provider=threads|linkedin`
- `POST /api/social/admin/verify-result` — `{ xUserId, taskId, ok, reason? }`;
  the only code path that creates points for Threads/LinkedIn tasks.

The generic `POST /api/tasks/:id/complete` explicitly rejects all four
verified tasks.

## Worker schedule

```cron
# Threads follower snapshot (~30 min) and bio checks (~5 min)
*/30 * * * *  workers/social-worker.sh threads-snapshot
*/5  * * * *  workers/social-worker.sh threads-pending
# LinkedIn: founder-driven
#   workers/social-worker.sh linkedin-pending
#   workers/social-worker.sh linkedin-verify <xUserId> true|false
```

Worker env: `ORUVA_API_URL`, `ORUVA_ADMIN_KEY` (see the script header).
The Threads modes require the @oruvatransport Threads account to be
linked to `threads-cli` via Meta Accounts Center, like the Instagram
worker's `instagram-cli` link.

## Configuration / approvals needed before this is live for the public

1. `ADMIN_KEY` set on the API (already required by the Instagram bot).
2. Worker host with `instagram-cli` + `threads-cli` linked to the
   @oruvatransport accounts, running the cron lines above.
3. Facebook: Meta app "Oruva Points" with the Facebook Login product,
   env `FB_APP_ID`, `FB_APP_SECRET`, `FB_PAGE_ID` (numeric Page id), and
   **Meta App Review approval for the `user_likes` permission** — until
   approval, only app-role/tester accounts can verify, everyone else
   gets "verification unavailable" and no points (fail-closed by design).
4. LinkedIn: no configuration possible — the founder (or a delegate with
   the admin key) runs the two `linkedin-*` worker commands.

## Tests

The flow was integration-tested locally against a throwaway database:
generic-complete rejection for all gated tasks, non-follower rejection,
bot negative → no points, bot positive → 1,000 pts with `verified=1`,
global username uniqueness, Facebook fail-closed when unconfigured, and
the full LinkedIn queue flow.
