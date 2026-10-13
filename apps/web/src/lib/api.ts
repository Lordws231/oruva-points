import type {
  ClaimableSeason,
  LeaderboardEntry,
  Pin,
  PointsMe,
  TaskDef,
  User,
} from "./types";

const BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      (data as { error?: string }).error ?? res.statusText,
      data
    );
  }
  return data as T;
}

export const api = {
  me: () => req<{ user: User | null }>("/api/auth/me"),
  xLogin: () => req<{ authorizeUrl: string }>("/api/auth/x"),
  logout: () => req<{ ok: true }>("/api/auth/logout", { method: "POST" }),

  tasks: () => req<{ tasks: TaskDef[] }>("/api/tasks"),
  completeTask: (id: string, confirm = false) =>
    req<{ ok: boolean; points?: number; verified?: boolean; attested?: boolean; note?: string; already?: boolean }>(
      `/api/tasks/${id}/complete`,
      { method: "POST", body: JSON.stringify({ confirm }) }
    ),
  completeHashtagPost: (tweetUrl: string) =>
    req<{ ok: boolean; points?: number; verified?: boolean; attested?: boolean; note?: string; already?: boolean }>(
      "/api/tasks/hashtag-post/complete",
      { method: "POST", body: JSON.stringify({ tweetUrl }) }
    ),
  completeEngagement: (tweetUrl: string) =>
    req<{
      ok: boolean;
      tier?: "verified" | "unverified";
      awarded?: { taskId: string; name: string; points: number }[];
      alreadyClaimed?: string[];
      notMet?: string[];
      totalPoints?: number;
      metrics?: {
        retweet_count: number;
        reply_count: number;
        like_count: number;
        quote_count: number;
      };
    }>("/api/tasks/engagement/complete", {
      method: "POST",
      body: JSON.stringify({ tweetUrl }),
    }),

  instagramFollowStart: (username: string) =>
    req<{
      ok: boolean;
      already?: boolean;
      points?: number;
      code?: string;
      username?: string;
      expiresInMinutes?: number;
    }>("/api/instagram/follow/start", {
      method: "POST",
      body: JSON.stringify({ username }),
    }),
  instagramFollowVerify: () =>
    req<{ ok: boolean; already?: boolean; status?: string }>(
      "/api/instagram/follow/verify",
      { method: "POST" }
    ),
  instagramFollowStatus: () =>
    req<{
      state: "none" | "pending" | "checking" | "done" | "failed" | "expired";
      code?: string;
      username?: string;
      expiresAt?: string;
    }>("/api/instagram/follow/status"),

  submitPin: (lat: number, lng: number, city?: string) =>
    req<{ ok: true; pin: Pin; points: number }>("/api/location", {
      method: "POST",
      body: JSON.stringify({ lat, lng, city }),
    }),
  myPins: () => req<{ pins: Pin[] }>("/api/location/mine"),

  pointsMe: () => req<PointsMe>("/api/points/me"),
  leaderboard: (opts?: { epoch?: string; season?: number }) =>
    req<{
      epoch?: string;
      season?: number;
      entries: LeaderboardEntry[];
      myRank: number | null;
    }>(
      `/api/leaderboard${
        opts?.season
          ? `?season=${opts.season}`
          : opts?.epoch
            ? `?epoch=${encodeURIComponent(opts.epoch)}`
            : ""
      }`
    ),
  epochCurrent: () =>
    req<{ id: string; startsAt: string; endsAt: string; finalized: boolean; totalPoints: number }>(
      "/api/epochs/current"
    ),

  claimSeasons: () => req<{ seasons: ClaimableSeason[] }>("/api/claim/seasons"),
  claimQuote: (season: number) =>
    req<{
      season: number;
      points: number;
      totalPoints: number;
      tokens: number;
      tokensBaseUnits: string;
      share: number;
      orvaPerSeason: number;
    }>(`/api/claim/quote?season=${season}`),
  claim: (season: number, wallet: string) =>
    req<{
      ok: true;
      season: number;
      points: number;
      tokens: number;
      txSig: string;
      explorerUrl: string;
    }>("/api/claim", { method: "POST", body: JSON.stringify({ season, wallet }) }),
};
