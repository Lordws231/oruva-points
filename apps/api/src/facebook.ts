/**
 * Facebook Login + Graph API helpers for FOLLOW_FACEBOOK verification.
 *
 * Flow: the user connects Facebook (OAuth, scopes public_profile +
 * user_likes), we store the long-lived user token, and before any points
 * are awarded the API checks GET /me/likes/<FB_PAGE_ID> with that token —
 * a non-empty result means the connected account likes/follows the Oruva
 * Page. There is no Page-side follower list on Facebook, so the user's
 * own authorized token is the only reliable verification channel.
 *
 * `user_likes` requires Meta App Review before non-tester users can grant
 * it. Until then (or until FB_* env is set) facebookConfigured() is the
 * gate and the task fails closed — points are never self-attested.
 *
 * Graph calls are unversioned so they use the app's configured API
 * version instead of a hardcoded version that can sunset.
 * Secrets/tokens come from env via config.ts and are never logged.
 */
import { config } from "./config.js";

const FB_AUTHORIZE_URL = "https://www.facebook.com/dialog/oauth";
const FB_TOKEN_URL = "https://graph.facebook.com/oauth/access_token";
const FB_GRAPH = "https://graph.facebook.com";
const FB_SCOPES = ["public_profile", "user_likes"];

export function facebookConfigured(): boolean {
  return Boolean(config.fbAppId && config.fbAppSecret && config.fbPageId);
}

export function facebookAuthorizeUrl(state: string): string {
  const u = new URL(FB_AUTHORIZE_URL);
  u.searchParams.set("client_id", config.fbAppId);
  u.searchParams.set("redirect_uri", config.fbRedirectUri);
  u.searchParams.set("scope", FB_SCOPES.join(","));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", state);
  return u.toString();
}

export interface FbTokenSet {
  accessToken: string;
  expiresAt: string | null;
}

async function graphJson(
  label: string,
  url: string,
  init?: RequestInit
): Promise<Record<string, unknown>> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as { message?: string } | undefined;
    throw new Error(`${label}: ${err?.message ?? `HTTP ${res.status}`}`);
  }
  return data;
}

/** Code → short-lived token → 60-day long-lived token. */
export async function facebookExchangeCode(code: string): Promise<FbTokenSet> {
  const shortUrl = new URL(FB_TOKEN_URL);
  shortUrl.searchParams.set("client_id", config.fbAppId);
  shortUrl.searchParams.set("client_secret", config.fbAppSecret);
  shortUrl.searchParams.set("redirect_uri", config.fbRedirectUri);
  shortUrl.searchParams.set("code", code);
  const short = await graphJson("Facebook token exchange", shortUrl.toString());
  const shortToken = short.access_token as string | undefined;
  if (!shortToken) throw new Error("Facebook token exchange: no access_token");

  const longUrl = new URL(FB_TOKEN_URL);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", config.fbAppId);
  longUrl.searchParams.set("client_secret", config.fbAppSecret);
  longUrl.searchParams.set("fb_exchange_token", shortToken);
  try {
    const long = await graphJson("Facebook long-lived exchange", longUrl.toString());
    const token = (long.access_token as string | undefined) ?? shortToken;
    const expiresIn = long.expires_in as number | undefined;
    return {
      accessToken: token,
      expiresAt: expiresIn
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null,
    };
  } catch {
    return { accessToken: shortToken, expiresAt: null };
  }
}

export async function fetchFacebookProfile(
  accessToken: string
): Promise<{ id: string; name: string }> {
  const u = new URL(`${FB_GRAPH}/me`);
  u.searchParams.set("fields", "id,name");
  u.searchParams.set("access_token", accessToken);
  const data = await graphJson("Facebook profile fetch", u.toString());
  const id = data.id as string | undefined;
  if (!id) throw new Error("Facebook profile fetch: missing id");
  return { id, name: (data.name as string | undefined) ?? "" };
}

export type FacebookFollowCheck =
  | { ok: true; following: boolean }
  | { ok: false; reason: string };

/**
 * True iff the token owner likes/follows the Oruva Page.
 * Primary: GET /me/likes/<pageId> (non-empty data = likes the Page).
 * Fallback: page through /me/likes and match the Page id.
 */
export async function checkFacebookFollowsPage(
  accessToken: string
): Promise<FacebookFollowCheck> {
  const pageId = config.fbPageId;
  try {
    const direct = new URL(`${FB_GRAPH}/me/likes/${encodeURIComponent(pageId)}`);
    direct.searchParams.set("access_token", accessToken);
    const d = await graphJson("Facebook likes check", direct.toString());
    const rows = d.data as unknown[] | undefined;
    if (Array.isArray(rows)) {
      return { ok: true, following: rows.length > 0 };
    }
  } catch (err) {
    // Some Graph versions error instead of returning empty data for a
    // non-liked Page — fall through to the list scan before deciding.
    void err;
  }
  try {
    let url: string | null = (() => {
      const u = new URL(`${FB_GRAPH}/me/likes`);
      u.searchParams.set("fields", "id");
      u.searchParams.set("limit", "100");
      u.searchParams.set("access_token", accessToken);
      return u.toString();
    })();
    for (let page = 0; page < 10 && url; page++) {
      const d: Record<string, unknown> = await graphJson(
        "Facebook likes scan",
        url
      );
      const rows = (d.data as { id?: string }[] | undefined) ?? [];
      if (rows.some((r) => r.id === pageId)) {
        return { ok: true, following: true };
      }
      const paging = d.paging as { next?: string } | undefined;
      url = paging?.next ?? null;
    }
    return { ok: true, following: false };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
