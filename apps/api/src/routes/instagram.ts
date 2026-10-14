import { Router, type NextFunction, type Request, type Response } from "express";
import { randomBytes } from "node:crypto";
import {
  FOLLOW_INSTAGRAM,
  epochId,
  isValidInstagramUsername,
  taskById,
} from "@oruva/shared";
import { config } from "../config.js";
import {
  awardOnce,
  bumpInstagramPendingAttempts,
  claimInstagramUsername,
  createInstagramPending,
  deleteInstagramPending,
  getInstagramPending,
  getSnapshotMeta,
  hasCompletedOnce,
  isInstagramUsernameClaimed,
  isSnapshotFollower,
  listAwaitingInstagramChecks,
  replaceFollowerSnapshot,
  setInstagramPendingStatus,
} from "../db.js";
import { requireAuth, type AuthedRequest } from "../session.js";

export const instagramRouter = Router();

/** Code shown to the user to paste into their Instagram bio (ownership proof). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
function makeBioCode(): string {
  const bytes = randomBytes(6);
  let s = "";
  for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `ORVA-${s}`;
}

/** Bio-code validity window. */
const CODE_TTL_MIN = 30;
/** Max "verify" taps per pending claim. */
const MAX_VERIFY_TAPS = 3;
/** Follower snapshot older than this is treated as stale (worker refreshes). */
const SNAPSHOT_MAX_AGE_MS = 45 * 60 * 1000;

function snapshotFresh(): boolean {
  const meta = getSnapshotMeta();
  if (!meta) return false;
  return Date.now() - new Date(meta.fetched_at).getTime() < SNAPSHOT_MAX_AGE_MS;
}

function pendingExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

// ---------------------------------------------------------------- user flow

/**
 * POST /api/instagram/follow/start — begin the Instagram follow claim.
 * Body: { username }.
 *
 * Checks the cached @oruvatransport follower snapshot: the username must
 * exist there (i.e. it follows the page). Then issues a one-time bio code
 * the user must add to their Instagram bio to prove ownership.
 * Usernames are globally unique: one Instagram username can only ever earn
 * FOLLOW_INSTAGRAM once, first-come.
 */
instagramRouter.post(
  "/follow/start",
  requireAuth,
  (req: AuthedRequest, res) => {
    const userId = req.xUserId!;
    const def = taskById("FOLLOW_INSTAGRAM");
    if (!def) {
      res.status(500).json({ error: "FOLLOW_INSTAGRAM task not configured" });
      return;
    }
    if (hasCompletedOnce(userId, "FOLLOW_INSTAGRAM")) {
      res.json({ ok: true, already: true, points: def.points });
      return;
    }

    const raw = (req.body as { username?: unknown } | undefined)?.username;
    if (typeof raw !== "string" || !isValidInstagramUsername(raw.trim())) {
      res.status(400).json({
        error:
          "invalid Instagram username — 1–30 chars, letters, numbers, . and _ only",
      });
      return;
    }
    const username = raw.trim().toLowerCase();

    if (!snapshotFresh()) {
      res.status(503).json({
        error:
          "follower verification is warming up — try again in a few minutes",
      });
      return;
    }
    if (!isSnapshotFollower(username)) {
      res.status(422).json({
        ok: false,
        reason: "not_following",
        error:
          "@oruvatransport doesn't show this username as a follower yet. Follow the page on Instagram, wait up to ~30 minutes, then try again.",
      });
      return;
    }
    if (isInstagramUsernameClaimed(username)) {
      res.status(409).json({
        ok: false,
        reason: "username_taken",
        error:
          "this Instagram username already earned the follow task — each username can only claim it once",
      });
      return;
    }

    const code = makeBioCode();
    const expiresAt = new Date(
      Date.now() + CODE_TTL_MIN * 60 * 1000
    ).toISOString();
    createInstagramPending(userId, username, code, expiresAt);
    res.json({ ok: true, code, expiresInMinutes: CODE_TTL_MIN, username });
  }
);

/**
 * POST /api/instagram/follow/verify — user confirms the bio code is added.
 * Queues a bio check; the worker confirms within a few minutes.
 */
instagramRouter.post(
  "/follow/verify",
  requireAuth,
  (req: AuthedRequest, res) => {
    const userId = req.xUserId!;
    if (hasCompletedOnce(userId, "FOLLOW_INSTAGRAM")) {
      deleteInstagramPending(userId);
      res.json({ ok: true, already: true });
      return;
    }
    const pending = getInstagramPending(userId);
    if (!pending) {
      res.status(404).json({
        error: "no pending claim — enter your Instagram username first",
      });
      return;
    }
    if (pendingExpired(pending.expires_at)) {
      deleteInstagramPending(userId);
      res.status(410).json({
        error: "code expired — start again for a fresh code",
      });
      return;
    }
    if (pending.status === "failed") {
      res.status(422).json({
        error: "too many attempts — start again for a fresh code",
      });
      return;
    }
    const attempts = bumpInstagramPendingAttempts(userId);
    if (attempts > MAX_VERIFY_TAPS) {
      setInstagramPendingStatus(userId, "failed");
      res.status(429).json({
        error: "too many verification attempts — start again",
      });
      return;
    }
    setInstagramPendingStatus(userId, "awaiting_check");
    res.json({ ok: true, status: "checking" });
  }
);

/**
 * GET /api/instagram/follow/status — poll the claim state.
 * none | pending | checking | done | failed | expired
 */
instagramRouter.get("/follow/status", requireAuth, (req: AuthedRequest, res) => {
  const userId = req.xUserId!;
  if (hasCompletedOnce(userId, "FOLLOW_INSTAGRAM")) {
    res.json({ state: "done" });
    return;
  }
  const pending = getInstagramPending(userId);
  if (!pending) {
    res.json({ state: "none" });
    return;
  }
  if (pendingExpired(pending.expires_at)) {
    deleteInstagramPending(userId);
    res.json({ state: "expired" });
    return;
  }
  res.json({
    state:
      pending.status === "awaiting_check"
        ? "checking"
        : pending.status === "failed"
          ? "failed"
          : "pending",
    code: pending.code,
    username: pending.username,
    expiresAt: pending.expires_at,
  });
});

// ---------------------------------------------------------------- worker (admin)

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!config.adminKey) {
    res.status(503).json({ error: "admin endpoints not configured" });
    return;
  }
  if (req.headers["x-admin-key"] !== config.adminKey) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  next();
}

/**
 * POST /api/instagram/admin/snapshot — replace the follower snapshot.
 * Body: { usernames: string[] }. Called by the scheduled worker.
 */
instagramRouter.post("/admin/snapshot", requireAdmin, (req, res) => {
  const body = (req.body ?? {}) as { usernames?: unknown };
  if (!Array.isArray(body.usernames)) {
    res.status(400).json({ error: "usernames array required" });
    return;
  }
  const clean = body.usernames
    .filter((u): u is string => typeof u === "string")
    .map((u) => u.trim().toLowerCase())
    .filter((u) => isValidInstagramUsername(u));
  replaceFollowerSnapshot(clean);
  res.json({ ok: true, count: clean.length });
});

/** GET /api/instagram/admin/pending — bio checks awaiting the worker. */
instagramRouter.get("/admin/pending", requireAdmin, (_req, res) => {
  const rows = listAwaitingInstagramChecks();
  res.json({
    pending: rows.map((r) => ({
      xUserId: r.x_user_id,
      username: r.username,
      code: r.code,
      attempts: r.attempts,
      expiresAt: r.expires_at,
    })),
  });
});

/**
 * POST /api/instagram/admin/verify-result — worker reports a bio check.
 * Body: { xUserId, ok, reason? }.
 * On ok: enforces global username uniqueness, awards FOLLOW_INSTAGRAM
 * (verified), and clears the pending claim — all idempotent.
 */
instagramRouter.post("/admin/verify-result", requireAdmin, (req, res) => {
  const body = (req.body ?? {}) as {
    xUserId?: unknown;
    ok?: unknown;
    reason?: unknown;
  };
  if (typeof body.xUserId !== "string" || typeof body.ok !== "boolean") {
    res.status(400).json({ error: "xUserId and ok required" });
    return;
  }
  const userId = body.xUserId;
  const pending = getInstagramPending(userId);
  if (!pending) {
    res.status(404).json({ error: "no pending claim for user" });
    return;
  }
  if (pendingExpired(pending.expires_at)) {
    deleteInstagramPending(userId);
    res.json({ ok: false, reason: "expired" });
    return;
  }
  if (!body.ok) {
    // Bio code not found yet — back to pending so the user can retry
    // after actually adding it (expiry is the backstop).
    setInstagramPendingStatus(userId, "pending");
    res.json({
      ok: true,
      awarded: false,
      reason:
        typeof body.reason === "string" ? body.reason : "code_not_in_bio",
    });
    return;
  }

  const def = taskById("FOLLOW_INSTAGRAM")!;
  if (hasCompletedOnce(userId, "FOLLOW_INSTAGRAM")) {
    deleteInstagramPending(userId);
    res.json({ ok: true, awarded: false, already: true });
    return;
  }
  // Global uniqueness: first verified claim wins, enforced at the DB level.
  if (!claimInstagramUsername(pending.username, userId)) {
    setInstagramPendingStatus(userId, "failed");
    res.json({
      ok: false,
      awarded: false,
      reason: "username_taken",
    });
    return;
  }
  const row = awardOnce(
    userId,
    "FOLLOW_INSTAGRAM",
    epochId(),
    def.points,
    true,
    `Instagram @${pending.username} follows @oruvatransport; bio-code ownership verified by bot`
  );
  deleteInstagramPending(userId);
  res.json({
    ok: true,
    awarded: row !== null,
    already: row === null,
    points: FOLLOW_INSTAGRAM,
  });
});
