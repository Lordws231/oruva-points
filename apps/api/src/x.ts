/**
 * X (Twitter) OAuth 2.0 with PKCE + follow verification.
 *
 * Flow: /api/auth/x -> authorize URL (PKCE) -> /api/auth/x/callback
 * exchanges code for tokens, fetches the X profile, and starts a session.
 *
 * Follow verification: GET /2/users/:me/following with an app bearer token.
 * On the free X API tier `follows.read` app-level checks are usually not
 * available, so when X_BEARER_TOKEN is missing — or the API errors — we
 * degrade gracefully to self-attestation: points are awarded with
 * verified=false and the response/README notes it.
 */
import { randomBytes, createHash } from "node:crypto";
import { config } from "./config.js";
import type { TweetMetrics } from "@oruva/shared";

const AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const SCOPES = ["tweet.read", "users.read", "follows.read", "offline.access"];

export interface PkcePair {
  verifier: string;
  challenge: string;
  state: string;
}

export function newPkce(): PkcePair {
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge, state: randomBytes(16).toString("hex") };
}

export function authorizeUrl(pkce: PkcePair): string {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", config.xClientId);
  u.searchParams.set("redirect_uri", config.xRedirectUri);
  u.searchParams.set("scope", SCOPES.join(" "));
  u.searchParams.set("state", pkce.state);
  u.searchParams.set("code_challenge", pkce.challenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

export interface XTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export async function exchangeCode(
  code: string,
  verifier: string
): Promise<XTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.xRedirectUri,
    code_challenge: verifier, // PKCE-only (public-client style) fallback
    code_verifier: verifier,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (config.xClientSecret) {
    const basic = Buffer.from(
      `${config.xClientId}:${config.xClientSecret}`
    ).toString("base64");
    headers["Authorization"] = `Basic ${basic}`;
  }
  const res = await fetch(TOKEN_URL, { method: "POST", headers, body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as XTokenResponse;
}

export interface XProfile {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
  verified?: boolean;
  verified_type?: string;
}

export async function fetchXProfile(accessToken: string): Promise<XProfile> {
  const res = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=profile_image_url,verified,verified_type",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X profile fetch failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { data: XProfile };
  return json.data;
}

export type FollowCheck =
  | { ok: true; following: boolean }
  | { ok: false; reason: string };

export type TweetCheck =
  | { ok: true; authorId: string; text: string; createdAt?: string }
  | { ok: false; reason: string };

/**
 * Fetch a single tweet (author + text) via the app bearer token, for
 * hashtag-post verification. Falls back with ok:false so the caller can
 * degrade to self-attestation — same pattern as checkFollows.
 */
export async function fetchTweet(tweetId: string): Promise<TweetCheck> {
  if (!config.xBearerToken) {
    return { ok: false, reason: "X_BEARER_TOKEN not configured" };
  }
  try {
    const u = new URL(`https://api.twitter.com/2/tweets/${tweetId}`);
    u.searchParams.set("tweet.fields", "author_id,text,created_at");
    const res = await fetch(u, {
      headers: { Authorization: `Bearer ${config.xBearerToken}` },
    });
    if (res.status === 429) {
      return { ok: false, reason: "X API rate limited" };
    }
    if (res.status === 404) {
      return { ok: false, reason: "tweet not found (deleted or protected)" };
    }
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        reason: `X API error ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const json = (await res.json()) as {
      data?: { author_id: string; text: string; created_at?: string };
    };
    if (!json.data) {
      return { ok: false, reason: "tweet not found" };
    }
    return {
      ok: true,
      authorId: json.data.author_id,
      text: json.data.text,
      createdAt: json.data.created_at,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "network error",
    };
  }
}

export type TweetMetricsCheck =
  | { ok: true; authorId: string; metrics: TweetMetrics; createdAt?: string }
  | { ok: false; reason: string };

/**
 * Fetch a single tweet's public metrics via the app bearer token, for
 * engagement-milestone checks. Unlike fetchTweet there is NO
 * self-attestation fallback — engagement metrics can't be attested, so
 * callers must return a 503 pending state when this fails.
 */
export async function fetchTweetMetrics(
  tweetId: string
): Promise<TweetMetricsCheck> {
  if (!config.xBearerToken) {
    return { ok: false, reason: "X_BEARER_TOKEN not configured" };
  }
  try {
    const u = new URL(`https://api.twitter.com/2/tweets/${tweetId}`);
    u.searchParams.set("tweet.fields", "public_metrics,author_id,created_at");
    const res = await fetch(u, {
      headers: { Authorization: `Bearer ${config.xBearerToken}` },
    });
    if (res.status === 429) {
      return { ok: false, reason: "X API rate limited" };
    }
    if (res.status === 404) {
      return { ok: false, reason: "tweet not found (deleted or protected)" };
    }
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        reason: `X API error ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const json = (await res.json()) as {
      data?: {
        author_id: string;
        public_metrics: TweetMetrics;
        created_at?: string;
      };
    };
    if (!json.data?.public_metrics) {
      return { ok: false, reason: "tweet metrics unavailable" };
    }
    return {
      ok: true,
      authorId: json.data.author_id,
      metrics: json.data.public_metrics,
      createdAt: json.data.created_at,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "network error",
    };
  }
}

/**
 * Check whether the authenticated X user follows `targetUserId`.
 * Uses the app bearer token (X_BEARER_TOKEN). Falls back with ok:false
 * so the caller can degrade to self-attestation.
 */
export async function checkFollows(
  meId: string,
  targetUserId: string
): Promise<FollowCheck> {
  if (!config.xBearerToken) {
    return { ok: false, reason: "X_BEARER_TOKEN not configured" };
  }
  if (!targetUserId) {
    return { ok: false, reason: "target X user id not configured" };
  }
  try {
    let following = false;
    let paginationToken: string | undefined;
    // Page through /following (max 1000/page) looking for the target id.
    for (let pages = 0; pages < 5; pages++) {
      const u = new URL(
        `https://api.twitter.com/2/users/${meId}/following`
      );
      u.searchParams.set("max_results", "1000");
      u.searchParams.set("user.fields", "id");
      if (paginationToken) u.searchParams.set("pagination_token", paginationToken);
      const res = await fetch(u, {
        headers: { Authorization: `Bearer ${config.xBearerToken}` },
      });
      if (res.status === 429) {
        return { ok: false, reason: "X API rate limited" };
      }
      if (!res.ok) {
        const text = await res.text();
        return {
          ok: false,
          reason: `X API error ${res.status}: ${text.slice(0, 200)}`,
        };
      }
      const json = (await res.json()) as {
        data?: { id: string }[];
        meta?: { next_token?: string };
      };
      if (json.data?.some((u2) => u2.id === targetUserId)) {
        following = true;
        break;
      }
      paginationToken = json.meta?.next_token;
      if (!paginationToken) break;
    }
    return { ok: true, following };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "network error",
    };
  }
}

/**
 * Resolve a numeric X user id from a username via the app bearer token.
 * Used to fill X_ORUVA_USER_ID / X_FOUNDER_USER_ID (see README).
 */
export async function resolveUserId(username: string): Promise<string> {
  if (!config.xBearerToken) throw new Error("X_BEARER_TOKEN not configured");
  const res = await fetch(
    `https://api.twitter.com/2/users/by/username/${encodeURIComponent(
      username
    )}`,
    { headers: { Authorization: `Bearer ${config.xBearerToken}` } }
  );
  if (!res.ok) {
    throw new Error(`X lookup failed (${res.status})`);
  }
  const json = (await res.json()) as { data: { id: string } };
  return json.data.id;
}
