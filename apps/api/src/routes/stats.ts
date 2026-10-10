import { Router } from "express";
import { epochFromDate, SEASON_COUNT } from "@oruva/shared";
import {
  userEpochPoints,
  lifetimePoints,
  claimableEpochs,
  leaderboard as dbLeaderboard,
  seasonLeaderboard,
  getEpoch,
  upsertEpoch,
  listEpochs,
} from "../db.js";
import { requireAuth, optionalAuth, type AuthedRequest } from "../session.js";

export const pointsRouter = Router();

/** GET /api/points/me — caller's current-epoch points + lifetime total. */
pointsRouter.get("/me", requireAuth, (req: AuthedRequest, res) => {
  const userId = req.xUserId!;
  const current = epochFromDate();
  const currentPoints = userEpochPoints(userId, current.id);
  const claimable = claimableEpochs(userId);
  res.json({
    epoch: current.id,
    currentPoints,
    lifetime: lifetimePoints(userId),
    claimableEpochs: claimable.map((e) => e.id),
  });
});

export const leaderboardRouter = Router();

function toEntries(
  rows: { username: string; avatar: string | null; points: number; x_user_id: string }[],
  me: string | null
) {
  return rows.map((r, i) => ({
    rank: i + 1,
    username: r.username,
    avatar: r.avatar,
    points: r.points,
    me: me !== null && r.x_user_id === me,
  }));
}

/**
 * GET /api/leaderboard?epoch=YYYY-MM-DD&season=N — top 50.
 * `season` (1-3) takes precedence: ranks by points summed across the
 * season's weeks. Defaults to the current week.
 */
leaderboardRouter.get("/", (req, res) => {
  const me = optionalAuth(req);
  const seasonParam = req.query.season as string | undefined;

  if (seasonParam !== undefined) {
    const seasonId = Number(seasonParam);
    if (
      !Number.isInteger(seasonId) ||
      seasonId < 1 ||
      seasonId > SEASON_COUNT
    ) {
      res.status(400).json({ error: "valid season query param required (1-3)" });
      return;
    }
    const rows = seasonLeaderboard(seasonId, 50);
    const rank = me
      ? seasonLeaderboard(seasonId, 1_000_000).findIndex(
          (r) => r.x_user_id === me
        ) + 1
      : null;
    res.json({
      season: seasonId,
      entries: toEntries(rows, me),
      myRank: rank && rank > 0 ? rank : null,
    });
    return;
  }

  const epoch = (req.query.epoch as string) || epochFromDate().id;
  const rows = dbLeaderboard(epoch, 50);
  const rank = me
    ? dbLeaderboard(epoch, 1_000_000).findIndex((r) => r.x_user_id === me) + 1
    : null;
  res.json({
    epoch,
    entries: toEntries(rows, me),
    myRank: rank && rank > 0 ? rank : null,
  });
});

export const epochsRouter = Router();

/** Ensure a row exists for the current epoch (idempotent). */
function ensureEpoch() {
  const e = epochFromDate();
  upsertEpoch(e.id, e.startsAt, e.endsAt);
  return e;
}

/** GET /api/epochs/current — current epoch id, window, finalized flag. */
epochsRouter.get("/current", (_req, res) => {
  const e = ensureEpoch();
  const row = getEpoch(e.id)!;
  res.json({
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    finalized: row.finalized === 1,
    totalPoints: row.total_points,
  });
});

/** GET /api/epochs — recent epochs, newest first. */
epochsRouter.get("/", (_req, res) => {
  ensureEpoch();
  res.json({ epochs: listEpochs() });
});
