import { Router } from "express";
import { PublicKey } from "@solana/web3.js";
import {
  SEASONS,
  SEASON_COUNT,
  ORVA_PER_SEASON,
  ORVA_DECIMALS,
  seasonEpochIds,
  seasonBounds,
  seasonStatus,
  seasonQuote,
} from "@oruva/shared";
import {
  getClaim,
  insertClaim,
  setWallet,
  seasonUserPoints,
  seasonTotalPoints,
} from "../db.js";
import { claimTokens, explorerTxUrl } from "../solana.js";
import { requireAuth, type AuthedRequest } from "../session.js";

export const claimRouter = Router();
claimRouter.use(requireAuth);

/** Simple in-memory lock to make double-click claims safe. */
const claimLocks = new Set<string>();

/**
 * Season claims are keyed in the `claims` table as epoch = "SEASON:<id>"
 * (e.g. "SEASON:1"). The PRIMARY KEY (x_user_id, epoch) then enforces one
 * claim per user per season; weekly ids ("YYYY-MM-DD") never collide.
 */
const seasonClaimKey = (seasonId: number): string => `SEASON:${seasonId}`;

function isValidSolanaAddress(addr: string): boolean {
  try {
    new PublicKey(addr);
    return true;
  } catch {
    return false;
  }
}

function parseSeasonParam(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= SEASON_COUNT ? n : null;
}

/** GET /api/claim/seasons — every season with the caller's claim state. */
claimRouter.get("/seasons", (req: AuthedRequest, res) => {
  const userId = req.xUserId!;
  const now = new Date();
  res.json({
    seasons: SEASONS.map((s) => {
      const b = seasonBounds(s.id)!;
      const points = seasonUserPoints(userId, s.id);
      const totalPoints = seasonTotalPoints(s.id);
      const quote = seasonQuote(points, totalPoints);
      const claim = getClaim(userId, seasonClaimKey(s.id));
      const status = seasonStatus(s.id, now);
      return {
        season: s.id,
        name: s.name,
        theme: s.theme,
        description: s.description,
        status,
        startsAt: b.startsAt.toISOString(),
        endsAt: b.endsAt.toISOString(),
        claimWindowEndsAt: b.claimWindowEndsAt.toISOString(),
        weekIds: seasonEpochIds(s.id),
        points,
        totalPoints,
        tokens: quote.tokens,
        share: quote.share,
        decimals: ORVA_DECIMALS,
        orvaPerSeason: ORVA_PER_SEASON,
        alreadyClaimed: !!claim,
        claimTxSig: claim?.tx_sig ?? null,
        claimExplorerUrl: claim?.tx_sig
          ? explorerTxUrl(claim.tx_sig)
          : null,
        claimWindowOpen: status === "claim-open",
      };
    }),
  });
});

/** GET /api/claim/quote?season=1 — preview a season claim. */
claimRouter.get("/quote", (req: AuthedRequest, res) => {
  const userId = req.xUserId!;
  const seasonId = parseSeasonParam(req.query.season);
  if (seasonId === null) {
    res
      .status(400)
      .json({ error: "valid season query param required (1-3)" });
    return;
  }
  const status = seasonStatus(seasonId, new Date());
  if (status === "upcoming" || status === "active") {
    res.status(422).json({
      error: "this season has not ended yet — claims open at season end",
    });
    return;
  }
  if (status === "closed") {
    res.status(422).json({
      error:
        "claim window closed — unclaimed allocation returns to treasury per policy",
    });
    return;
  }
  const points = seasonUserPoints(userId, seasonId);
  if (points <= 0) {
    res.status(422).json({ error: "no points earned in this season" });
    return;
  }
  if (getClaim(userId, seasonClaimKey(seasonId))) {
    res.status(409).json({ error: "already claimed" });
    return;
  }
  const totalPoints = seasonTotalPoints(seasonId);
  const quote = seasonQuote(points, totalPoints);
  res.json({
    season: seasonId,
    points,
    totalPoints,
    tokens: quote.tokens,
    tokensBaseUnits: quote.tokensBaseUnits.toString(),
    share: quote.share,
    decimals: ORVA_DECIMALS,
    orvaPerSeason: ORVA_PER_SEASON,
  });
});

/**
 * POST /api/claim { season, wallet } — execute the SPL transfer.
 * Idempotent: one claim row per (user, season).
 */
claimRouter.post("/", async (req: AuthedRequest, res) => {
  const userId = req.xUserId!;
  const { season, wallet } = (req.body ?? {}) as {
    season?: unknown;
    wallet?: string;
  };
  const seasonId = parseSeasonParam(season);

  if (
    seasonId === null ||
    typeof wallet !== "string" ||
    !isValidSolanaAddress(wallet)
  ) {
    res
      .status(400)
      .json({ error: "valid season (1-3) and Solana wallet required" });
    return;
  }
  const status = seasonStatus(seasonId, new Date());
  if (status !== "claim-open") {
    res.status(422).json({
      error:
        status === "closed"
          ? "claim window closed — unclaimed allocation returns to treasury per policy"
          : "this season has not ended yet — claims open at season end",
    });
    return;
  }
  const points = seasonUserPoints(userId, seasonId);
  if (points <= 0) {
    res.status(422).json({ error: "no points earned in this season" });
    return;
  }
  const key = seasonClaimKey(seasonId);
  const existing = getClaim(userId, key);
  if (existing) {
    res.status(409).json({
      error: "already claimed",
      txSig: existing.tx_sig,
      explorerUrl: existing.tx_sig
        ? explorerTxUrl(existing.tx_sig)
        : undefined,
    });
    return;
  }

  const lockKey = `${userId}:season:${seasonId}`;
  if (claimLocks.has(lockKey)) {
    res.status(409).json({ error: "claim already in progress" });
    return;
  }
  claimLocks.add(lockKey);
  try {
    const totalPoints = seasonTotalPoints(seasonId);
    const quote = seasonQuote(points, totalPoints);
    if (quote.tokens <= 0) {
      res.status(422).json({ error: "allocation rounds to zero tokens" });
      return;
    }
    setWallet(userId, wallet);
    const result = await claimTokens(wallet, quote.tokensBaseUnits);
    const claim = insertClaim(
      userId,
      key,
      points,
      quote.tokens,
      result.txSig
    );
    res.json({
      ok: true,
      season: seasonId,
      points,
      tokens: quote.tokens,
      txSig: claim.tx_sig,
      explorerUrl: explorerTxUrl(result.txSig),
    });
  } catch (err) {
    res.status(502).json({
      error: "claim failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  } finally {
    claimLocks.delete(lockKey);
  }
});
