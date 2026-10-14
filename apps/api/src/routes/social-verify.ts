/**
 * Social follow-verification bot API — Facebook, Threads, LinkedIn.
 * (Instagram has its own equivalent flow in routes/instagram.ts.)
 *
 * RULE: points for FOLLOW_THREADS, FOLLOW_FACEBOOK and
 * FOLLOW_FOUNDER_LINKEDIN are awarded ONLY after a positive verification.
 * There is no self-attestation path anymore — an unverified, failed or
 * unavailable check awards NOTHING.
 *
 * How each platform is verified:
 * - Threads: bot worker (workers/social-worker.sh) keeps a follower
 *   snapshot of @Oruvatransport (threads-cli). Start requires the claimed
 *   username to be in the snapshot (= it follows the page); the user then
 *   adds a one-time code to their Threads bio (ownership proof) and the
 *   bot confirms the code before points land.
 * - LinkedIn: LinkedIn offers NO API to check whether a member follows a
 *   person or Page (follower APIs are aggregate/admin-only), and no bot
 *   can read LinkedIn profiles. The flow therefore uses the same
 *   pending-code queue: the user adds the code to their LinkedIn About
 *   section, and the verification result is submitted — via the worker —
 *   only after the founder's own LinkedIn follower list and the profile
 *   code have been checked. Fail-closed: no result, no points.
 * - Facebook: the user connects Facebook (user_likes) and the API checks
 *   GET /me/likes/<FB_PAGE_ID> live (see ../facebook.ts). Facebook has no
 *   Page follower list, so the user's authorized token is the channel.
 *
 * Admin (bot) endpoints use the same x-admin-key as the Instagram bot.
 * One social username can earn its task once, globally (first-come).
 */
import { Router } from "express";
import { randomBytes } from "node:crypto";
import {
  epochId,
  isValidInstagramUsername,
  linkedInSlugFromUrl,
  taskById,
} from "@oruva/shared";
import {
  awardOnce,
  bumpSocialPendingAttempts,
  claimSocialUsername,
  createSocialPending,
  deleteSocialPending,
  getLinkedAccount,
  getSocialPending,
  getSocialSnapshotEntry,
  getSocialSnapshotMeta,
  hasCompletedOnce,
  isSocialUsernameClaimed,
  listAwaitingSocialChecks,
  replaceSocialSnapshot,
  setSocialPendingStatus,
  type SocialProvider,
} from "../db.js";
import { requireAuth, type AuthedRequest } from "../session.js";
import { requireAdmin } from "./instagram.js";
import { checkFacebookFollowsPage, facebookConfigured } from "../facebook.js";

export const socialRouter = Router();

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
function makeCode(): string {
  const bytes = randomBytes(6);
  let s = "";
  for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `ORVA-${s}`;
}
const CODE_TTL_MIN = 30;
const MAX_VERIFY_TAPS = 3;
const SNAPSHOT_MAX_AGE_MS = 45 * 60 * 1000;

interface TaskSpec {
  taskId: string;
  provider: SocialProvider;
  display: string;
  codeTarget: string; // where the user puts the code
}

const SPECS: Record<string, TaskSpec> = {
  FOLLOW_THREADS: {
    taskId: "FOLLOW_THREADS",
    provider: "threads",
    display: "Threads",
    codeTarget: "Threads bio",
  },
  FOLLOW_FOUNDER_LINKEDIN: {
    taskId: "FOLLOW_FOUNDER_LINKEDIN",
    provider: "linkedin",
    display: "LinkedIn",
    codeTarget: "LinkedIn About section",
  },
  FOLLOW_ORUVA_LINKEDIN: {
    taskId: "FOLLOW_ORUVA_LINKEDIN",
    provider: "linkedin",
    display: "LinkedIn",
    codeTarget: "LinkedIn About section",
  },
};

function snapshotFresh(provider: SocialProvider): boolean {
  const meta = getSocialSnapshotMeta(provider);
  if (!meta) return false;
  return Date.now() - new Date(meta.fetched_at).getTime() < SNAPSHOT_MAX_AGE_MS;
}

function pendingExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

// ------------------------------------------------------------ user flow

/**
 * POST /api/social/facebook/verify — live Graph check, then (and only
 * then) award FOLLOW_FACEBOOK. Requires a linked Facebook account.
 */
socialRouter.post("/facebook/verify", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.xUserId!;
  const def = taskById("FOLLOW_FACEBOOK");
  if (!def) {
    res.status(500).json({ error: "FOLLOW_FACEBOOK task not configured" });
    return;
  }
  if (hasCompletedOnce(userId, "FOLLOW_FACEBOOK")) {
    res.json({ ok: true, already: true, points: def.points });
    return;
  }
  if (!facebookConfigured()) {
    res.status(503).json({
      ok: false,
      reason: "verification_unavailable",
      error:
        "Facebook verification is not configured yet — points are NOT awarded until the check can run. Please try again later.",
    });
    return;
  }
  const linked = getLinkedAccount(userId, "facebook");
  if (!linked) {
    res.status(400).json({
      ok: false,
      reason: "not_linked",
      error: "connect your Facebook account first, then verify",
    });
    return;
  }
  const check = await checkFacebookFollowsPage(linked.access_token);
  if (!check.ok) {
    res.status(503).json({
      ok: false,
      reason: "check_failed",
      error: `Facebook check couldn't run (${check.reason}) — no points awarded, please try again later.`,
    });
    return;
  }
  if (!check.following) {
    res.status(422).json({
      ok: false,
      reason: "not_following",
      error:
        "Facebook doesn't show your connected account as following/liking @Oruvatransport yet. Follow the Page, wait a moment, then verify again.",
    });
    return;
  }
  const fbUsername = linked.username.toLowerCase();
  if (isSocialUsernameClaimed("facebook", fbUsername, "FOLLOW_FACEBOOK")) {
    res.status(409).json({
      ok: false,
      reason: "username_taken",
      error: "this Facebook account already earned the follow task",
    });
    return;
  }
  claimSocialUsername("facebook", fbUsername, userId, "FOLLOW_FACEBOOK");
  const row = awardOnce(
    userId,
    "FOLLOW_FACEBOOK",
    epochId(),
    def.points,
    true,
    `Facebook follow verified via Graph API /me/likes (account ${linked.username})`
  );
  if (!row) {
    res.json({ ok: true, already: true, points: def.points });
    return;
  }
  res.json({ ok: true, points: def.points, verified: true });
});

/**
 * POST /api/social/:taskId/start — begin a Threads/LinkedIn claim.
 * Threads body: { username }. LinkedIn body: { profileUrl }.
 */
socialRouter.post("/:taskId/start", requireAuth, (req: AuthedRequest, res) => {
  const spec = SPECS[req.params.taskId];
  if (!spec) {
    res.status(404).json({
      error:
        "no code-verification flow for this task (Facebook: POST /api/social/facebook/verify; Instagram: POST /api/instagram/follow/start)",
    });
    return;
  }
  const userId = req.xUserId!;
  const def = taskById(spec.taskId);
  if (!def) {
    res.status(500).json({ error: `${spec.taskId} task not configured` });
    return;
  }
  if (hasCompletedOnce(userId, spec.taskId)) {
    res.json({ ok: true, already: true, points: def.points });
    return;
  }

  // Resolve and validate the claimed identity.
  let username: string;
  let providerUserId: string | null = null;
  if (spec.provider === "threads") {
    const raw = (req.body as { username?: unknown } | undefined)?.username;
    if (typeof raw !== "string" || !isValidInstagramUsername(raw.trim())) {
      res.status(400).json({
        error:
          "invalid Threads username — 1–30 chars, letters, numbers, . and _ only",
      });
      return;
    }
    username = raw.trim().toLowerCase();
    if (!snapshotFresh("threads")) {
      res.status(503).json({
        error:
          "follower verification is warming up — try again in a few minutes",
      });
      return;
    }
    const entry = getSocialSnapshotEntry("threads", username);
    if (!entry) {
      res.status(422).json({
        ok: false,
        reason: "not_following",
        error:
          "@Oruvatransport doesn't show this username as a follower yet. Follow the page on Threads, wait up to ~30 minutes, then try again.",
      });
      return;
    }
    providerUserId = entry.provider_user_id;
  } else {
    const raw = (req.body as { profileUrl?: unknown } | undefined)?.profileUrl;
    const slug =
      typeof raw === "string" ? linkedInSlugFromUrl(raw) : null;
    if (!slug) {
      res.status(400).json({
        error:
          "invalid LinkedIn profile URL — expected https://www.linkedin.com/in/<your-profile>",
      });
      return;
    }
    username = slug;
  }

  if (isSocialUsernameClaimed(spec.provider, username, spec.taskId)) {
    res.status(409).json({
      ok: false,
      reason: "username_taken",
      error: `this ${spec.display} account already earned the follow task — each account can only claim it once`,
    });
    return;
  }

  const code = makeCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60 * 1000).toISOString();
  createSocialPending(userId, spec.taskId, spec.provider, username, providerUserId, code, expiresAt);
  res.json({
    ok: true,
    code,
    username,
    expiresInMinutes: CODE_TTL_MIN,
    codeTarget: spec.codeTarget,
  });
});

/** POST /api/social/:taskId/verify — queue the bot check. */
socialRouter.post("/:taskId/verify", requireAuth, (req: AuthedRequest, res) => {
  const spec = SPECS[req.params.taskId];
  if (!spec) {
    res.status(404).json({ error: "no code-verification flow for this task" });
    return;
  }
  const userId = req.xUserId!;
  if (hasCompletedOnce(userId, spec.taskId)) {
    deleteSocialPending(userId, spec.taskId);
    res.json({ ok: true, already: true });
    return;
  }
  const pending = getSocialPending(userId, spec.taskId);
  if (!pending) {
    res.status(404).json({ error: "no pending claim — start the task first" });
    return;
  }
  if (pendingExpired(pending.expires_at)) {
    deleteSocialPending(userId, spec.taskId);
    res.status(410).json({ error: "code expired — start again for a fresh code" });
    return;
  }
  if (pending.status === "failed") {
    res.status(422).json({ error: "too many attempts — start again for a fresh code" });
    return;
  }
  const attempts = bumpSocialPendingAttempts(userId, spec.taskId);
  if (attempts > MAX_VERIFY_TAPS) {
    setSocialPendingStatus(userId, spec.taskId, "failed");
    res.status(429).json({ error: "too many verification attempts — start again" });
    return;
  }
  // Threads: re-check the follower snapshot at queue time, so an
  // unfollow between start and verify cannot slip through.
  if (spec.provider === "threads" && !getSocialSnapshotEntry("threads", pending.username)) {
    res.status(422).json({
      ok: false,
      reason: "not_following",
      error:
        "this username no longer appears in @Oruvatransport's Threads followers — follow the page, then try again.",
    });
    return;
  }
  setSocialPendingStatus(userId, spec.taskId, "awaiting_check");
  res.json({ ok: true, status: "checking" });
});

/** GET /api/social/:taskId/status — none | pending | checking | done | failed | expired */
socialRouter.get("/:taskId/status", requireAuth, (req: AuthedRequest, res) => {
  const spec = SPECS[req.params.taskId];
  if (!spec) {
    res.status(404).json({ error: "no code-verification flow for this task" });
    return;
  }
  const userId = req.xUserId!;
  if (hasCompletedOnce(userId, spec.taskId)) {
    res.json({ state: "done" });
    return;
  }
  const pending = getSocialPending(userId, spec.taskId);
  if (!pending) {
    res.json({ state: "none" });
    return;
  }
  if (pendingExpired(pending.expires_at)) {
    deleteSocialPending(userId, spec.taskId);
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

// ------------------------------------------------------------- bot (admin)

/**
 * POST /api/social/admin/snapshot — replace a provider's follower
 * snapshot. Body: { provider: "threads", entries: [{username, providerUserId}] }.
 * (LinkedIn snapshots are accepted for completeness but the LinkedIn gate
 * is the verify-result below, not the snapshot.)
 */
socialRouter.post("/admin/snapshot", requireAdmin, (req, res) => {
  const body = (req.body ?? {}) as {
    provider?: unknown;
    entries?: unknown;
  };
  if (body.provider !== "threads" && body.provider !== "linkedin") {
    res.status(400).json({ error: "provider must be 'threads' or 'linkedin'" });
    return;
  }
  if (!Array.isArray(body.entries)) {
    res.status(400).json({ error: "entries array required" });
    return;
  }
  const clean = body.entries
    .filter(
      (e): e is { username: string; providerUserId?: unknown } =>
        typeof e === "object" && e !== null &&
        typeof (e as { username?: unknown }).username === "string"
    )
    .map((e) => ({
      username: (e.username as string).trim().toLowerCase(),
      providerUserId:
        typeof e.providerUserId === "string" ? e.providerUserId : null,
    }))
    .filter((e) => e.username.length > 0);
  replaceSocialSnapshot(body.provider as SocialProvider, clean);
  res.json({ ok: true, count: clean.length });
});

/** GET /api/social/admin/pending?provider=threads|linkedin */
socialRouter.get("/admin/pending", requireAdmin, (req, res) => {
  const provider = req.query.provider as string | undefined;
  if (provider && provider !== "threads" && provider !== "linkedin") {
    res.status(400).json({ error: "provider must be 'threads' or 'linkedin'" });
    return;
  }
  const rows = listAwaitingSocialChecks(provider as SocialProvider | undefined);
  res.json({
    pending: rows.map((r) => ({
      xUserId: r.x_user_id,
      taskId: r.task_id,
      provider: r.provider,
      username: r.username,
      providerUserId: r.provider_user_id,
      code: r.code,
      expiresAt: r.expires_at,
    })),
  });
});

/**
 * POST /api/social/admin/verify-result — the bot's verdict.
 * Body: { xUserId, taskId, ok, reason? }.
 * On ok: global-claim check, then award with verified=1. Points exist
 * only because this endpoint said the follow + code were confirmed.
 */
socialRouter.post("/admin/verify-result", requireAdmin, (req, res) => {
  const body = (req.body ?? {}) as {
    xUserId?: unknown;
    taskId?: unknown;
    ok?: unknown;
    reason?: unknown;
  };
  const xUserId = body.xUserId as string;
  const taskId = body.taskId as string;
  const spec = SPECS[taskId];
  if (!spec || typeof xUserId !== "string") {
    res.status(400).json({ error: "xUserId and a valid taskId are required" });
    return;
  }
  const pending = getSocialPending(xUserId, taskId);
  if (!pending) {
    res.status(404).json({ error: "no pending claim for this user/task" });
    return;
  }
  if (body.ok !== true) {
    setSocialPendingStatus(xUserId, taskId, "pending");
    res.json({ ok: true, awarded: false, reason: body.reason ?? "not_verified" });
    return;
  }
  const def = taskById(taskId)!;
  if (hasCompletedOnce(xUserId, taskId)) {
    deleteSocialPending(xUserId, taskId);
    res.json({ ok: true, awarded: false, reason: "already_completed" });
    return;
  }
  // Threads: the follow must still hold at award time.
  if (
    spec.provider === "threads" &&
    !getSocialSnapshotEntry("threads", pending.username)
  ) {
    setSocialPendingStatus(xUserId, taskId, "pending");
    res.json({ ok: true, awarded: false, reason: "not_following" });
    return;
  }
  if (!claimSocialUsername(spec.provider, pending.username, xUserId, taskId)) {
    setSocialPendingStatus(xUserId, taskId, "failed");
    deleteSocialPending(xUserId, taskId);
    res.json({ ok: true, awarded: false, reason: "username_taken" });
    return;
  }
  awardOnce(
    xUserId,
    taskId,
    epochId(),
    def.points,
    true,
    `${spec.display} @${pending.username} follow + profile-code ownership verified by verification bot`
  );
  deleteSocialPending(xUserId, taskId);
  res.json({ ok: true, awarded: true, points: def.points });
});
