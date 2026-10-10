/**
 * Epoch finalization worker.
 *
 * Finalizes the just-ended weekly epoch: snapshots its total points and
 * marks it finalized. Weekly epochs are the accounting layer — points
 * accrue per week, while ORVA payouts happen per *season* (3 seasons of
 * 26 weeks; claims open at each season's end with a 14-day window).
 *
 * Run weekly via cron, shortly after Monday 00:00 Africa/Lagos:
 *
 *   # m h dom mon dow — 00:05 WAT every Monday
 *   5 0 * * 1 cd /path/to/oruva-points && npm run worker --workspace apps/api
 *
 * (WAT is UTC+1 year-round, so 00:05 local = 23:05 UTC Sunday.)
 */
import {
  epochFromDate,
  previousEpoch,
  seasonForEpochId,
  SEASONS,
} from "@oruva/shared";
import {
  upsertEpoch,
  getEpoch,
  finalizeEpoch,
  epochTotalPoints,
  listEpochs,
} from "./db.js";

async function main(): Promise<void> {
  const now = new Date();
  const current = epochFromDate(now);
  const ended = previousEpoch(current);

  // Make sure both rows exist.
  upsertEpoch(current.id, current.startsAt, current.endsAt);
  upsertEpoch(ended.id, ended.startsAt, ended.endsAt);

  const row = getEpoch(ended.id)!;
  if (row.finalized === 1) {
    console.log(`epoch ${ended.id} already finalized (${row.total_points} pts)`);
    return;
  }

  const total = epochTotalPoints(ended.id);
  finalizeEpoch(ended.id, total);
  console.log(
    `finalized epoch ${ended.id}: ${total} total points across all users`
  );
  const seasonId = seasonForEpochId(ended.id);
  console.log(
    seasonId === null
      ? `epoch ${ended.id} is outside the farming program (no season)`
      : `epoch ${ended.id} belongs to season ${seasonId} (${SEASONS[seasonId - 1].name})`
  );
  console.log(
    `season claims open at each season's end with a 14-day window; ` +
      `unclaimed allocation returns to treasury per TREASURY_WALLET policy ` +
      `(see docs/ARCHITECTURE.md)`
  );

  // Sanity: show recent epochs.
  for (const e of listEpochs(4)) {
    console.log(`  ${e.id} finalized=${e.finalized} total=${e.total_points}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
