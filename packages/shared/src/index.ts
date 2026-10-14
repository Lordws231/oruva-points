/**
 * @oruva/shared — pure TypeScript, no dependencies.
 *
 * Shared task definitions, point values, epoch math (Africa/Lagos),
 * and geo helpers used by both apps/api and apps/web.
 */

// ---------------------------------------------------------------- tasks

export type TaskRepeatability = "once" | "repeatable";

export interface TaskDef {
  id: string;
  title: string;
  description: string;
  points: number;
  repeatability: TaskRepeatability;
  /** Max completions per user per day (repeatable tasks only) */
  dailyCap?: number;
  /** Proof / destination link shown to the user */
  url?: string;
}

export const FOLLOW_ORUVA_X = 1000;
export const FOLLOW_FOUNDER_X = 1000;
export const FOLLOW_FOUNDER_LINKEDIN = 1000;
export const FOLLOW_ORUVA_LINKEDIN = 1000;
export const JOIN_DISCORD = 1000;
export const FOLLOW_INSTAGRAM = 1000;
export const FOLLOW_THREADS = 1000;
export const FOLLOW_FACEBOOK = 1000;
export const LOCATION_PIN = 1500;
/** Points per verified hashtag post. Edit this one constant to retune. */
export const HASHTAG_POST = 100;

// ---------------------------------------------------------------- engagement milestones
// Tipcoin-style: points for tweet metrics. The tier is the CLAIMANT's X
// verification status (refreshed at every login; NULL = unverified).
// Threshold semantics: "over N" = strictly > N; "N" / "with N" = >= N.

/** Points per milestone — edit these single constants to retune. */
export const ENG_RT_VERIFIED = 250;
export const ENG_QUOTE_VERIFIED = 300;
export const ENG_LIKES_VERIFIED = 200;
export const ENG_REPLIES_VERIFIED = 200;
export const ENG_RT_UNVERIFIED = 150;
export const ENG_QUOTE_UNVERIFIED = 150;
export const ENG_LIKES_UNVERIFIED = 150;
export const ENG_REPLIES_UNVERIFIED = 100;

export type EngagementMetric = "retweets" | "quotes" | "likes" | "replies";

export interface EngagementMilestone {
  taskId: string;
  metric: EngagementMetric;
  /** true = verified X accounts tier; false = unverified tier */
  verifiedTier: boolean;
  /** threshold on the metric */
  minCount: number;
  /** true => strictly > minCount; false (default) => >= minCount */
  strictGt?: boolean;
  /** optional secondary gate on like_count */
  minLikes?: number;
  /** true => strictly > minLikes; false (default) => >= minLikes */
  strictGtLikes?: boolean;
}

export const ENGAGEMENT_MILESTONES: EngagementMilestone[] = [
  // Verified tier: "retweeted by 100 ... with over 100 likes"
  { taskId: "ENG_RT_VERIFIED", metric: "retweets", verifiedTier: true, minCount: 100, minLikes: 100, strictGtLikes: true },
  // Verified tier: "quoted by 100 ... with over 100 likes"
  { taskId: "ENG_QUOTE_VERIFIED", metric: "quotes", verifiedTier: true, minCount: 100, minLikes: 100, strictGtLikes: true },
  // Verified tier: "over 500 likes"
  { taskId: "ENG_LIKES_VERIFIED", metric: "likes", verifiedTier: true, minCount: 500, strictGt: true },
  // Verified tier: "over 100 replies"
  { taskId: "ENG_REPLIES_VERIFIED", metric: "replies", verifiedTier: true, minCount: 100, strictGt: true },
  // Unverified tier: "retweeted by 50 ... with 50 likes"
  { taskId: "ENG_RT_UNVERIFIED", metric: "retweets", verifiedTier: false, minCount: 50, minLikes: 50 },
  // Unverified tier: "quoted by 50"
  { taskId: "ENG_QUOTE_UNVERIFIED", metric: "quotes", verifiedTier: false, minCount: 50 },
  // Unverified tier: "100 likes"
  { taskId: "ENG_LIKES_UNVERIFIED", metric: "likes", verifiedTier: false, minCount: 100 },
  // Unverified tier: "50 replies"
  { taskId: "ENG_REPLIES_UNVERIFIED", metric: "replies", verifiedTier: false, minCount: 50 },
];

/** Raw public_metrics shape from X API v2. */
export interface TweetMetrics {
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
}

/** Evaluate one milestone against a tweet's public_metrics. */
export function milestoneMet(m: EngagementMilestone, pm: TweetMetrics): boolean {
  const value =
    m.metric === "retweets" ? pm.retweet_count
    : m.metric === "quotes" ? pm.quote_count
    : m.metric === "likes" ? pm.like_count
    : pm.reply_count;
  const metricOk = m.strictGt ? value > m.minCount : value >= m.minCount;
  const likesOk =
    m.minLikes === undefined
      ? true
      : m.strictGtLikes
        ? pm.like_count > m.minLikes
        : pm.like_count >= m.minLikes;
  return metricOk && likesOk;
}

/** Human-readable threshold, e.g. "100+ retweets and over 100 likes". */
export function describeMilestone(m: EngagementMilestone): string {
  const names: Record<EngagementMetric, string> = {
    retweets: "retweets",
    quotes: "quotes",
    likes: "likes",
    replies: "replies",
  };
  const main = m.strictGt
    ? `over ${m.minCount} ${names[m.metric]}`
    : `${m.minCount}+ ${names[m.metric]}`;
  if (m.minLikes === undefined) return main;
  const gate = m.strictGtLikes
    ? `over ${m.minLikes} likes`
    : `${m.minLikes}+ likes`;
  return `${main} and ${gate}`;
}

/**
 * Instagram username rules: 1–30 chars of letters, numbers, "." and "_";
 * no leading/trailing dot, no consecutive dots.
 */
export const IG_USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/;
export function isValidInstagramUsername(u: string): boolean {
  return (
    IG_USERNAME_RE.test(u) &&
    !u.startsWith(".") &&
    !u.endsWith(".") &&
    !u.includes("..")
  );
}

/**
 * LinkedIn personal-profile URL → vanity slug, e.g.
 * "https://www.linkedin.com/in/abiodun-oyaniyi-6aab0a253/" → the slug.
 * Returns null for anything that is not a /in/<slug> profile URL.
 * Used by the LinkedIn follow-verification flow (ownership + follow are
 * confirmed against the founder's follower list before points award).
 */
export function linkedInSlugFromUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
  const m = /^\/in\/([A-Za-z0-9][A-Za-z0-9\-_%.]*)\/?$/.exec(u.pathname);
  if (!m) return null;
  let slug = m[1];
  try {
    slug = decodeURIComponent(slug);
  } catch {
    /* keep raw */
  }
  slug = slug.toLowerCase();
  return slug.length >= 3 && slug.length <= 100 ? slug : null;
}

/** Campaign hashtags (matched case-insensitively). */
export const CAMPAIGN_HASHTAGS = [
  "#Oruvatransport",
  "#Oruvatransportationservices",
  "#Oruvatransportation",
] as const;

/** True if `text` contains at least one campaign hashtag (case-insensitive). */
export function containsCampaignHashtag(text: string): boolean {
  const lower = text.toLowerCase();
  return CAMPAIGN_HASHTAGS.some((tag) => lower.includes(tag.toLowerCase()));
}

/** Minimum haversine distance (meters) between a user's consecutive pins. */
export const MIN_PIN_DISTANCE_M = 100;
/** Max location pins a user can earn per calendar day. */
export const MAX_PINS_PER_DAY = 10;

export const TASKS: TaskDef[] = [
  {
    id: "FOLLOW_ORUVA_X",
    title: "Follow @Oruvatransport on X",
    description:
      "Follow the official Oruva Transportation Services page on X (Twitter).",
    points: FOLLOW_ORUVA_X,
    repeatability: "once",
    url: "https://x.com/Oruvatransport",
  },
  {
    id: "FOLLOW_FOUNDER_X",
    title: "Follow founder @AbiodunOyaniyi on X",
    description: "Follow the founder of Oruva Transportation Services on X.",
    points: FOLLOW_FOUNDER_X,
    repeatability: "once",
    url: "https://x.com/AbiodunOyaniyi",
  },
  {
    id: "FOLLOW_FOUNDER_LINKEDIN",
    title: "Follow founder on LinkedIn",
    description:
      "Follow the founder of Oruva Transportation Services on LinkedIn, then enter your LinkedIn profile URL below. Points are awarded only after verification — our verification bot checks the founder's follower list and the one-time code you add to your LinkedIn About section. No verification, no points.",
    points: FOLLOW_FOUNDER_LINKEDIN,
    repeatability: "once",
    url: "https://www.linkedin.com/in/abiodun-oyaniyi-6aab0a253",
  },
  {
    id: "FOLLOW_ORUVA_LINKEDIN",
    title: "Follow Oruva Transportation Services on LinkedIn",
    description:
      "Follow the official Oruva Transportation Services company Page on LinkedIn, then enter your LinkedIn profile URL below. Points are awarded only after verification — the Page admin's follower list and the one-time code you add to your LinkedIn About section are checked first. No verification, no points.",
    points: FOLLOW_ORUVA_LINKEDIN,
    repeatability: "once",
    url: "https://www.linkedin.com/company/oruvatransport/",
  },
  {
    id: "JOIN_DISCORD",
    title: "Join the Oruva Discord server",
    description:
      "Join the official Oruva Transportation Services Discord community — announcements, ORVA leaderboard, polls, and support.",
    points: JOIN_DISCORD,
    repeatability: "once",
    url: "https://discord.gg/6G67trYsMw",
  },
  {
    id: "FOLLOW_INSTAGRAM",
    title: "Follow @oruvatransport on Instagram",
    description:
      "Follow the official Oruva Transportation Services page on Instagram, then enter your Instagram username below. Our bot checks that you follow the page, then gives you a code to add to your bio to prove the account is yours. 1,000 pts — one username can only earn this once.",
    points: FOLLOW_INSTAGRAM,
    repeatability: "once",
    url: "https://www.instagram.com/oruvatransport/",
  },
  {
    id: "FOLLOW_THREADS",
    title: "Follow @Oruvatransport on Threads",
    description:
      "Follow the official Oruva Transportation Services page on Threads, then enter your Threads username below. Our verification bot checks that you follow the page, then gives you a code to add to your Threads bio to prove the account is yours. 1,000 pts — awarded only after verification.",
    points: FOLLOW_THREADS,
    repeatability: "once",
    url: "https://www.threads.com/@oruvatransport",
  },
  {
    id: "FOLLOW_FACEBOOK",
    title: "Follow @Oruvatransport on Facebook",
    description:
      "Follow the official Oruva Transportation Services page on Facebook, connect your Facebook account, then tap Verify. We check your liked/followed Pages directly with Facebook before awarding the 1,000 pts — no verification, no points.",
    points: FOLLOW_FACEBOOK,
    repeatability: "once",
    url: "https://www.facebook.com/Oruvatransport",
  },
  {
    id: "LOCATION_PIN",
    title: "Share live area location pinpoint",
    description:
      "Drop a live location pinpoint on the map. Earn 1,500 pts per pin — keep sharing real locations, up to 10 pins per day. Each new pin must be at least 100 m from your previous pins.",
    points: LOCATION_PIN,
    repeatability: "repeatable",
    dailyCap: MAX_PINS_PER_DAY,
  },
  {
    id: "HASHTAG_POST",
    title: "Post on X with campaign hashtags",
    description:
      "Post on X including at least one campaign hashtag (#Oruvatransport, #Oruvatransportationservices or #Oruvatransportation), then paste the post URL below to verify. Earn 100 pts per post — no daily limit, but each post can only be claimed once.",
    points: HASHTAG_POST,
    repeatability: "repeatable",
    url: "https://x.com/Oruvatransport",
  },
  // Engagement milestones (tipcoin-style: points for tweet metrics).
  // Tier is the claimant's X verification status; each milestone is
  // repeatable across posts but claimable only once per post.
  {
    id: "ENG_RT_VERIFIED",
    title: "100+ retweets & over 100 likes (verified account)",
    description:
      "Verified X accounts: your post gets 100+ retweets and over 100 likes. 250 pts per post — each milestone claimable once per post.",
    points: ENG_RT_VERIFIED,
    repeatability: "repeatable",
  },
  {
    id: "ENG_QUOTE_VERIFIED",
    title: "100+ quotes & over 100 likes (verified account)",
    description:
      "Verified X accounts: your post gets 100+ quotes and over 100 likes. 300 pts per post — each milestone claimable once per post.",
    points: ENG_QUOTE_VERIFIED,
    repeatability: "repeatable",
  },
  {
    id: "ENG_LIKES_VERIFIED",
    title: "Over 500 likes (verified account)",
    description:
      "Verified X accounts: your post gets over 500 likes. 200 pts per post — each milestone claimable once per post.",
    points: ENG_LIKES_VERIFIED,
    repeatability: "repeatable",
  },
  {
    id: "ENG_REPLIES_VERIFIED",
    title: "Over 100 replies (verified account)",
    description:
      "Verified X accounts: your post gets over 100 replies. 200 pts per post — each milestone claimable once per post.",
    points: ENG_REPLIES_VERIFIED,
    repeatability: "repeatable",
  },
  {
    id: "ENG_RT_UNVERIFIED",
    title: "50+ retweets & 50+ likes (unverified account)",
    description:
      "Unverified X accounts: your post gets 50+ retweets and 50+ likes. 150 pts per post — each milestone claimable once per post.",
    points: ENG_RT_UNVERIFIED,
    repeatability: "repeatable",
  },
  {
    id: "ENG_QUOTE_UNVERIFIED",
    title: "50+ quotes (unverified account)",
    description:
      "Unverified X accounts: your post gets 50+ quotes. 150 pts per post — each milestone claimable once per post.",
    points: ENG_QUOTE_UNVERIFIED,
    repeatability: "repeatable",
  },
  {
    id: "ENG_LIKES_UNVERIFIED",
    title: "100+ likes (unverified account)",
    description:
      "Unverified X accounts: your post gets 100+ likes. 150 pts per post — each milestone claimable once per post.",
    points: ENG_LIKES_UNVERIFIED,
    repeatability: "repeatable",
  },
  {
    id: "ENG_REPLIES_UNVERIFIED",
    title: "50+ replies (unverified account)",
    description:
      "Unverified X accounts: your post gets 50+ replies. 100 pts per post — each milestone claimable once per post.",
    points: ENG_REPLIES_UNVERIFIED,
    repeatability: "repeatable",
  },
];

export function taskById(id: string): TaskDef | undefined {
  return TASKS.find((t) => t.id === id);
}

// ---------------------------------------------------------------- epochs
// Weekly epochs starting Monday 00:00 Africa/Lagos (UTC+1, no DST).

export const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export interface Epoch {
  /** e.g. "2026-10-05" — the Monday (Africa/Lagos) the epoch starts */
  id: string;
  startsAt: Date; // Monday 00:00 Africa/Lagos
  endsAt: Date; // next Monday 00:00 Africa/Lagos
}

/** Epoch that contains `date` (defaults to now). */
export function epochFromDate(date: Date = new Date()): Epoch {
  const lagos = date.getTime() + LAGOS_OFFSET_MS;
  const d = new Date(lagos); // shifted so UTC fields read as Lagos wall time
  // 0=Sun..6=Sat in UTC fields of the shifted date
  const day = d.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const mondayShifted = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - daysSinceMonday,
    0,
    0,
    0,
    0
  );
  const startsAt = new Date(mondayShifted - LAGOS_OFFSET_MS);
  const mondayDate = new Date(mondayShifted);
  const id = `${mondayDate.getUTCFullYear()}-${pad(
    mondayDate.getUTCMonth() + 1
  )}-${pad(mondayDate.getUTCDate())}`;
  return { id, startsAt, endsAt: new Date(startsAt.getTime() + WEEK_MS) };
}

/** The epoch immediately before the given one. */
export function previousEpoch(epoch: Epoch): Epoch {
  return epochFromDate(new Date(epoch.startsAt.getTime() - 1));
}

/**
 * Weekly claim-window predicate from the original per-epoch model.
 *
 * @deprecated Claims now open per season (see isSeasonClaimOpen). Kept for
 * compat — weekly epochs remain the points accounting layer.
 */
export function isInClaimWindow(
  earningEpoch: Epoch,
  now: Date = new Date()
): boolean {
  const claimEpoch = epochFromDate(
    new Date(earningEpoch.endsAt.getTime() + 1)
  );
  return now >= claimEpoch.startsAt && now < claimEpoch.endsAt;
}

export function epochId(date: Date = new Date()): string {
  return epochFromDate(date).id;
}

// ---------------------------------------------------------------- tokens

export const ORVA_DECIMALS = 9;
export const ORVA_TOTAL_SUPPLY = 1_000_000_000;
/**
 * @deprecated Weekly per-epoch payouts are replaced by the seasonal claim
 * model (see ORVA_PER_SEASON / seasonQuote below). Kept for compat.
 */
export const ORVA_PER_EPOCH_DEFAULT = 1_000_000;

/**
 * Pro-rata token allocation: userShare = userPoints / totalPoints.
 * Whole-token floor in base units (9 decimals).
 *
 * @deprecated Weekly per-epoch claims are replaced by per-season claims
 * (see seasonQuote). Kept for compat.
 */
export function quoteClaim(
  userPoints: number,
  totalPoints: number,
  orvaPerEpoch: number = ORVA_PER_EPOCH_DEFAULT
): { tokens: number; tokensBaseUnits: bigint; share: number } {
  if (userPoints <= 0 || totalPoints <= 0) {
    return { tokens: 0, tokensBaseUnits: 0n, share: 0 };
  }
  const share = userPoints / totalPoints;
  const tokens = Math.floor(share * orvaPerEpoch);
  return {
    tokens,
    tokensBaseUnits: BigInt(tokens) * 10n ** BigInt(ORVA_DECIMALS),
    share,
  };
}

// ---------------------------------------------------------------- seasons
// Seasonal claim model: the 18-month engagement farming program is split into
// 3 seasons of 26 weekly epochs (6 months each). Points still accrue per weekly
// epoch (the ledger is untouched); a user's season score is the sum of their
// points across the season's 26 weeks, and payouts are computed per season at
// season end.

/**
 * First Monday (Africa/Lagos) of the farming program.
 * Changeable any time before launch. Verified: 2026-10-26 is a Monday.
 * Postponed from 2026-10-12 on Oct 13, 2026 — site was live but zero
 * points had been farmed and no launch announcement had gone out.
 */
export const FARMING_START_EPOCH_ID = "2026-10-26";
/** Weekly epochs per season (26 weeks ≈ 6 months). */
export const SEASON_WEEKS = 26;
/** Number of seasons in the program. */
export const SEASON_COUNT = 3;
/** Total program length in weeks (SEASON_WEEKS * SEASON_COUNT). */
export const PROGRAM_WEEKS = SEASON_WEEKS * SEASON_COUNT;
/**
 * ORVA paid out per season: 30% of the 1B supply (300,000,000) across
 * 3 seasons. Notional weekly dial ≈ 3.85M/week, but payouts are
 * computed per season, not per week.
 */
export const ORVA_PER_SEASON = 100_000_000;
/** Days after a season ends during which its claim window stays open. */
export const CLAIM_WINDOW_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SeasonDef {
  id: number;
  name: string;
  theme: string;
  description: string;
}

export const SEASONS: SeasonDef[] = [
  {
    id: 1,
    name: "Ignition",
    theme: "User testing",
    description:
      "Months 1–6: get real riders and drivers onto the platform and shake out bugs.",
  },
  {
    id: 2,
    name: "Refinement",
    theme: "Feedback",
    description:
      "Months 7–12: structured feedback loops — iterate on the product with the community.",
  },
  {
    id: 3,
    name: "Acceleration",
    theme: "Growth",
    description:
      "Months 13–18: referral and acquisition push ahead of the wider launch.",
  },
];

function parseEpochIdDate(
  epochId: string
): { y: number; m: number; d: number } | null {
  const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(epochId);
  if (!mt) return null;
  return { y: Number(mt[1]), m: Number(mt[2]), d: Number(mt[3]) };
}

/** UTC midnight of the given Lagos-calendar Monday date (pure calendar math). */
function epochIdToUtcMidnight(epochId: string): number | null {
  const p = parseEpochIdDate(epochId);
  if (!p) return null;
  return Date.UTC(p.y, p.m - 1, p.d);
}

function utcMidnightToEpochId(t: number): string {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate()
  )}`;
}

/**
 * The 26 weekly epoch ids belonging to a season (1-based).
 * Returns [] for invalid season ids.
 */
export function seasonEpochIds(seasonId: number): string[] {
  if (
    !Number.isInteger(seasonId) ||
    seasonId < 1 ||
    seasonId > SEASON_COUNT
  ) {
    return [];
  }
  const start = epochIdToUtcMidnight(FARMING_START_EPOCH_ID)!;
  const first = start + (seasonId - 1) * SEASON_WEEKS * WEEK_MS;
  return Array.from({ length: SEASON_WEEKS }, (_, i) =>
    utcMidnightToEpochId(first + i * WEEK_MS)
  );
}

/**
 * 1-based season containing `epochId`, or null if the epoch is outside
 * the farming program.
 */
export function seasonForEpochId(epochId: string): number | null {
  const t = epochIdToUtcMidnight(epochId);
  const start = epochIdToUtcMidnight(FARMING_START_EPOCH_ID)!;
  if (t === null || t < start) return null;
  const diffDays = Math.round((t - start) / DAY_MS);
  if (diffDays % 7 !== 0) return null;
  const season = Math.floor(diffDays / 7 / SEASON_WEEKS) + 1;
  return season >= 1 && season <= SEASON_COUNT ? season : null;
}

export interface SeasonBounds {
  /** Monday 00:00 Africa/Lagos, first week of the season. */
  startsAt: Date;
  /** Monday 00:00 Africa/Lagos, after the season's 26th week. */
  endsAt: Date;
  /** End of the 14-day claim window. */
  claimWindowEndsAt: Date;
}

/** Wall-clock bounds of a season (1-based). Null for invalid ids. */
export function seasonBounds(seasonId: number): SeasonBounds | null {
  const ids = seasonEpochIds(seasonId);
  if (ids.length === 0) return null;
  const firstUtc = epochIdToUtcMidnight(ids[0])!;
  // Monday 00:00 Africa/Lagos = 23:00 UTC the previous day.
  const startsAt = new Date(firstUtc - LAGOS_OFFSET_MS);
  const endsAt = new Date(startsAt.getTime() + SEASON_WEEKS * WEEK_MS);
  return {
    startsAt,
    endsAt,
    claimWindowEndsAt: new Date(
      endsAt.getTime() + CLAIM_WINDOW_DAYS * DAY_MS
    ),
  };
}

export type SeasonStatus = "upcoming" | "active" | "claim-open" | "closed";

/**
 * Lifecycle status of a season at `now`. Out-of-range ids read as
 * "upcoming" (< 1) or "closed" (> SEASON_COUNT).
 */
export function seasonStatus(
  seasonId: number,
  now: Date = new Date()
): SeasonStatus {
  if (seasonId < 1) return "upcoming";
  if (seasonId > SEASON_COUNT) return "closed";
  const b = seasonBounds(seasonId)!;
  if (now < b.startsAt) return "upcoming";
  if (now < b.endsAt) return "active";
  if (now < b.claimWindowEndsAt) return "claim-open";
  return "closed";
}

/** True while a season's 14-day claim window is open. */
export function isSeasonClaimOpen(
  seasonId: number,
  now: Date = new Date()
): boolean {
  return seasonStatus(seasonId, now) === "claim-open";
}

/**
 * Pro-rata season payout: userShare = userSeasonPoints / totalSeasonPoints.
 * Whole-token floor in base units (9 decimals).
 */
export function seasonQuote(
  userPoints: number,
  totalPoints: number
): { tokens: number; tokensBaseUnits: bigint; share: number } {
  if (userPoints <= 0 || totalPoints <= 0) {
    return { tokens: 0, tokensBaseUnits: 0n, share: 0 };
  }
  const share = userPoints / totalPoints;
  const tokens = Math.floor(share * ORVA_PER_SEASON);
  return {
    tokens,
    tokensBaseUnits: BigInt(tokens) * 10n ** BigInt(ORVA_DECIMALS),
    share,
  };
}

// ---------------------------------------------------------------- geo

/** Haversine distance in meters between two lat/lng pairs. */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}
