import { Router } from "express";
import {
  TASKS,
  taskById,
  CAMPAIGN_HASHTAGS,
  containsCampaignHashtag,
  ENGAGEMENT_MILESTONES,
  milestoneMet,
} from "@oruva/shared";
import { fetchTweet, checkFollows, fetchTweetMetrics } from "../x.js";
import { config } from "../config.js";
import {
  awardOnce,
  engagementTaskId,
  getUser,
  hasClaimedTweet,
  hasCompletedOnce,
  hashtagTaskId,
  userCompletions,
} from "../db.js";
import { requireAuth, type AuthedRequest } from "../session.js";
import { epochId } from "@oruva/shared";

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

/** GET /api/tasks — task defs + the caller's completion status. */
tasksRouter.get("/", (req: AuthedRequest, res) => {
  const userId = req.xUserId!;
  const completions = userCompletions(userId);
  const isRepeatableRow = (taskId: string) =>
    taskId.startsWith("LOCATION_PIN:") ||
    taskId.startsWith("HASHTAG_POST:") ||
    taskId.startsWith("ENG_");
  const onceDone = new Set(
    completions.filter((c) => !isRepeatableRow(c.task_id)).map((c) => c.task_id)
  );
  const repeatableCount = (prefix: string) =>
    completions.filter((c) => c.task_id.startsWith(`${prefix}:`)).length;
  res.json({
    tasks: TASKS.map((t) => ({
      ...t,
      completed:
        t.repeatability === "once"
          ? onceDone.has(t.id)
          : repeatableCount(t.id) > 0,
      timesCompleted:
        t.repeatability === "repeatable" ? repeatableCount(t.id) : undefined,
      verified: completions.find((c) => c.task_id === t.id)?.verified === 1,
    })),
  });
});

interface CompleteBody {
  /** For LinkedIn: user confirms they followed. */
  confirm?: boolean;
}

interface HashtagBody {
  tweetUrl?: string;
}

/** Accept x.com / twitter.com /status/<id> URLs only. */
const TWEET_URL_RE =
  /^https?:\/\/(www\.)?(x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/(\d+)(?:[/?#].*)?$/;

function extractTweetId(url: string): string | null {
  const m = url.trim().match(TWEET_URL_RE);
  return m ? m[3] : null;
}

/**
 * POST /api/tasks/hashtag-post/complete — claim points for an X post
 * containing a campaign hashtag. Body: { tweetUrl }.
 *
 * Verifies via GET /2/tweets/:id when X_BEARER_TOKEN works (author must be
 * the claiming user and the text must include a campaign hashtag);
 * otherwise degrades to self-attestation (verified=false) — same pattern
 * as the follow tasks. Dedupe: task_id is HASHTAG_POST:<tweetId>, so a
 * tweet can never be claimed twice by the same user. No daily cap.
 *
 * NOTE: registered before "/:id/complete" so Express matches it first.
 */
tasksRouter.post("/hashtag-post/complete", async (req: AuthedRequest, res) => {
  const userId = req.xUserId!;
  const def = taskById("HASHTAG_POST");
  if (!def) {
    res.status(500).json({ error: "HASHTAG_POST task not configured" });
    return;
  }

  const { tweetUrl } = (req.body ?? {}) as HashtagBody;
  if (typeof tweetUrl !== "string" || !tweetUrl.trim()) {
    res.status(400).json({
      error: "tweetUrl is required — paste the link to your X post",
    });
    return;
  }
  const tweetId = extractTweetId(tweetUrl);
  if (!tweetId) {
    res.status(400).json({
      error:
        "invalid tweet URL — expected https://x.com/<handle>/status/<id>",
    });
    return;
  }
  if (hasClaimedTweet(userId, tweetId)) {
    res
      .status(409)
      .json({ ok: false, already: true, error: "this post was already claimed" });
    return;
  }

  const epoch = epochId();
  const taskRowId = hashtagTaskId(tweetId);
  const check = await fetchTweet(tweetId);

  if (check.ok) {
    if (check.authorId !== userId) {
      res.status(422).json({
        ok: false,
        reason: "not_your_post",
        error: "that post wasn't written by your connected X account",
      });
      return;
    }
    if (!containsCampaignHashtag(check.text)) {
      res.status(422).json({
        ok: false,
        reason: "missing_hashtag",
        error: `the post must include a campaign hashtag (${CAMPAIGN_HASHTAGS.join(" ")})`,
      });
      return;
    }
    const row = awardOnce(userId, taskRowId, epoch, def.points, true, `tweet ${tweetId} verified via X API`);
    if (!row) {
      res
        .status(409)
        .json({ ok: false, already: true, error: "this post was already claimed" });
      return;
    }
    res.json({ ok: true, points: def.points, verified: true });
    return;
  }

  // Degraded path: award with verified=false so the campaign keeps moving.
  const row = awardOnce(
    userId,
    taskRowId,
    epoch,
    def.points,
    false,
    `self-attested (X API unavailable: ${check.reason})`
  );
  if (!row) {
    res
      .status(409)
      .json({ ok: false, already: true, error: "this post was already claimed" });
    return;
  }
  res.json({
    ok: true,
    points: def.points,
    verified: false,
    attested: true,
    note: `X post verification unavailable (${check.reason}). Points awarded on self-attestation — a later audit can re-verify via the X API.`,
  });
});

/**
 * POST /api/tasks/engagement/complete — claim engagement-milestone points
 * for your own X post. Body: { tweetUrl }.
 *
 * Requires X_BEARER_TOKEN (X API Basic tier or higher): engagement metrics
 * can't be self-attested, so without working API access this returns 503
 * and awards NOTHING (no attestation fallback — unlike follows/hashtags).
 *
 * Milestones are evaluated against the CLAIMANT's X verification tier
 * (stored at login, refreshed on every sign-in; NULL = unverified).
 * Dedupe: ledger task_id is <TASK_ID>:<tweetId>, so each milestone can be
 * claimed once per post. Unlimited per day.
 *
 * NOTE: registered before "/:id/complete" so Express matches it first.
 */
tasksRouter.post("/engagement/complete", async (req: AuthedRequest, res) => {
  const userId = req.xUserId!;

  const { tweetUrl } = (req.body ?? {}) as HashtagBody;
  if (typeof tweetUrl !== "string" || !tweetUrl.trim()) {
    res.status(400).json({
      error: "tweetUrl is required — paste the link to your X post",
    });
    return;
  }
  const tweetId = extractTweetId(tweetUrl);
  if (!tweetId) {
    res.status(400).json({
      error:
        "invalid tweet URL — expected https://x.com/<handle>/status/<id>",
    });
    return;
  }

  const pending = (reason: string) => {
    const message =
      `Engagement milestone checks need X API access (Basic tier or higher). ` +
      `${reason} No points were awarded — try again once X_BEARER_TOKEN is ` +
      `configured and working.`;
    res.status(503).json({ status: "pending", error: message, message });
  };

  if (!config.xBearerToken) {
    pending("X_BEARER_TOKEN is not configured.");
    return;
  }

  const check = await fetchTweetMetrics(tweetId);
  if (!check.ok) {
    pending(`X API lookup failed: ${check.reason}.`);
    return;
  }
  if (check.authorId !== userId) {
    res.status(422).json({
      ok: false,
      reason: "not_your_post",
      error: "only your own posts can earn engagement points",
    });
    return;
  }

  const user = getUser(userId);
  const tierVerified = user?.x_verified === 1; // NULL = unverified
  const epoch = epochId();
  const milestones = ENGAGEMENT_MILESTONES.filter(
    (m) => m.verifiedTier === tierVerified
  );

  const awarded: { taskId: string; name: string; points: number }[] = [];
  const alreadyClaimed: string[] = [];
  const notMet: string[] = [];

  for (const m of milestones) {
    const def = taskById(m.taskId);
    if (!def) {
      notMet.push(m.taskId);
      continue;
    }
    const ledgerId = engagementTaskId(m.taskId, tweetId);
    if (!milestoneMet(m, check.metrics)) {
      notMet.push(m.taskId);
      continue;
    }
    if (hasCompletedOnce(userId, ledgerId)) {
      alreadyClaimed.push(m.taskId);
      continue;
    }
    const row = awardOnce(
      userId,
      ledgerId,
      epoch,
      def.points,
      true,
      `tweet ${tweetId} engagement metrics verified via X API`
    );
    if (row) {
      awarded.push({ taskId: m.taskId, name: def.title, points: def.points });
    } else {
      alreadyClaimed.push(m.taskId);
    }
  }

  const totalPoints = awarded.reduce((s, a) => s + a.points, 0);
  res.json({
    ok: true,
    tier: tierVerified ? "verified" : "unverified",
    awarded,
    alreadyClaimed,
    notMet,
    totalPoints,
    metrics: check.metrics,
  });
});

/**
 * POST /api/tasks/:id/complete — verify (or attest) a follow task.
 *
 * X follow tasks: real verification via GET /2/users/:id/following when
 * X_BEARER_TOKEN works; otherwise self-attestation (verified=false).
 * LinkedIn: no public follow API — always self-attestation.
 */
tasksRouter.post("/:id/complete", async (req: AuthedRequest, res) => {
  const userId = req.xUserId!;
  const taskId = req.params.id;
  const def = taskById(taskId);
  if (
    !def ||
    def.id === "LOCATION_PIN" ||
    def.id === "HASHTAG_POST" ||
    def.id === "FOLLOW_INSTAGRAM" ||
    def.id.startsWith("ENG_")
  ) {
    res.status(404).json({
      error:
        "unknown task (pins: POST /api/location; hashtag posts: POST /api/tasks/hashtag-post/complete; engagement: POST /api/tasks/engagement/complete; Instagram follow: POST /api/instagram/follow/start)",
    });
    return;
  }
  if (hasCompletedOnce(userId, taskId)) {
    res.json({ ok: true, already: true, points: def.points });
    return;
  }

  const epoch = epochId();
  const body = (req.body ?? {}) as CompleteBody;

  // Self-attested tasks (no public verification API): LinkedIn follow,
  // Discord join, Threads follow (until Threads account linking ships).
  if (
    taskId === "FOLLOW_FOUNDER_LINKEDIN" ||
    taskId === "JOIN_DISCORD" ||
    taskId === "FOLLOW_THREADS"
  ) {
    if (body.confirm !== true) {
      res.status(400).json({
        error:
          taskId === "JOIN_DISCORD"
            ? "Discord joins can't be verified via API — send {confirm:true} to attest you joined the server."
            : taskId === "FOLLOW_THREADS"
              ? "Threads follows aren't auto-verified yet — send {confirm:true} to attest you followed @oruvatransport."
              : "LinkedIn follows can't be verified via API — send {confirm:true} to attest you followed.",
      });
      return;
    }
    awardOnce(userId, taskId, epoch, def.points, false, "self-attested");
    res.json({
      ok: true,
      points: def.points,
      verified: false,
      attested: true,
      note:
        taskId === "JOIN_DISCORD"
          ? "Discord has no public join-verification API for this app; points awarded on self-attestation."
          : taskId === "FOLLOW_THREADS"
            ? "Threads follow verification arrives with Threads account linking; points awarded on self-attestation for now."
            : "LinkedIn has no public follow-verification API; points awarded on self-attestation.",
    });
    return;
  }

  // X follow tasks
  const targetId =
    taskId === "FOLLOW_ORUVA_X" ? config.xOruvaUserId : config.xFounderUserId;
  const check = await checkFollows(userId, targetId);

  if (!check.ok) {
    // Degraded path: award with verified=false so the campaign keeps moving.
    awardOnce(
      userId,
      taskId,
      epoch,
      def.points,
      false,
      `self-attested (X API unavailable: ${check.reason})`
    );
    res.json({
      ok: true,
      points: def.points,
      verified: false,
      attested: true,
      note: `X follow verification unavailable (${check.reason}). Points awarded on self-attestation — a later audit can re-verify via the X API.`,
    });
    return;
  }

  if (!check.following) {
    res.status(422).json({
      ok: false,
      completed: false,
      reason: "not_following",
      message: `Our check didn't find the follow yet. Follow the account, wait a few seconds, then try again.`,
    });
    return;
  }

  awardOnce(userId, taskId, epoch, def.points, true, "verified via X API");
  res.json({ ok: true, points: def.points, verified: true });
});
