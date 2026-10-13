/**
 * Meta OAuth helpers: Threads API and Instagram API (with Instagram Login).
 *
 * Endpoints verified against Meta's docs (Oct 2026):
 * - Threads:  authorize https://threads.net/oauth/authorize
 *             token     POST https://graph.threads.net/oauth/access_token
 *             long-live GET  https://graph.threads.net/access_token
 *                       (grant_type=th_exchange_token)
 *             profile   GET  https://graph.threads.net/v1.0/me?fields=id,username
 * - Instagram: authorize https://www.instagram.com/oauth/authorize
 *             token     POST https://api.instagram.com/oauth/access_token
 *             long-live GET  https://graph.instagram.com/access_token
 *                       (grant_type=ig_exchange_token)
 *             profile   GET  https://graph.instagram.com/me?fields=id,username
 *
 * All secrets come from env via config.ts — nothing hardcoded here,
 * and access tokens are never logged.
 */
import { config } from "./config.js";

// ---------------------------------------------------------------- Threads

const THREADS_AUTHORIZE_URL = "https://threads.net/oauth/authorize";
const THREADS_TOKEN_URL = "https://graph.threads.net/oauth/access_token";
const THREADS_EXCHANGE_URL = "https://graph.threads.net/access_token";
const THREADS_PROFILE_URL = "https://graph.threads.net/v1.0/me";
const THREADS_SCOPES = ["threads_basic", "threads_manage_insights"];

export function threadsConfigured(): boolean {
  return Boolean(config.threadsAppId && config.threadsAppSecret);
}

export function threadsAuthorizeUrl(state: string): string {
  const u = new URL(THREADS_AUTHORIZE_URL);
  u.searchParams.set("client_id", config.threadsAppId);
  u.searchParams.set("redirect_uri", config.threadsRedirectUri);
  u.searchParams.set("scope", THREADS_SCOPES.join(","));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", state);
  return u.toString();
}

// ---------------------------------------------------------------- Instagram

const IG_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const IG_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const IG_EXCHANGE_URL = "https://graph.instagram.com/access_token";
const IG_PROFILE_URL = "https://graph.instagram.com/me";
const IG_SCOPES = ["instagram_business_basic"];

export function instagramConfigured(): boolean {
  return Boolean(config.igAppId && config.igAppSecret);
}

export function instagramAuthorizeUrl(state: string): string {
  const u = new URL(IG_AUTHORIZE_URL);
  u.searchParams.set("client_id", config.igAppId);
  u.searchParams.set("redirect_uri", config.igRedirectUri);
  u.searchParams.set("scope", IG_SCOPES.join(","));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", state);
  return u.toString();
}

// ---------------------------------------------------------------- shared flow

export interface MetaTokenSet {
  accessToken: string;
  /** ISO datetime when the long-lived token expires (null if unknown). */
  expiresAt: string | null;
}

export interface MetaProfile {
  id: string;
  username: string;
}

/** Throw a sanitized error for a failed token/profile HTTP call (no tokens). */
async function throwMetaError(
  label: string,
  res: Response
): Promise<never> {
  const text = await res.text().catch(() => "");
  throw new Error(`${label} failed (${res.status}): ${text.slice(0, 200)}`);
}

interface ShortTokenResponse {
  access_token: string;
  user_id?: number | string;
}

interface LongTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

async function postForm(
  url: string,
  params: Record<string, string>,
  label: string
): Promise<ShortTokenResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  if (!res.ok) await throwMetaError(label, res);
  const json = (await res.json()) as ShortTokenResponse;
  if (!json.access_token) throw new Error(`${label}: no access_token returned`);
  return json;
}

async function exchangeLongLived(
  exchangeUrl: string,
  grantType: string,
  clientSecret: string,
  shortToken: string,
  label: string
): Promise<MetaTokenSet> {
  const u = new URL(exchangeUrl);
  u.searchParams.set("grant_type", grantType);
  u.searchParams.set("client_secret", clientSecret);
  u.searchParams.set("access_token", shortToken);
  const res = await fetch(u);
  if (!res.ok) await throwMetaError(label, res);
  const json = (await res.json()) as LongTokenResponse;
  if (!json.access_token) throw new Error(`${label}: no access_token returned`);
  return {
    accessToken: json.access_token,
    expiresAt: json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null,
  };
}

/** Full Threads code → short-lived → 60-day long-lived token exchange. */
export async function threadsExchangeCode(code: string): Promise<MetaTokenSet> {
  const short = await postForm(
    THREADS_TOKEN_URL,
    {
      client_id: config.threadsAppId,
      client_secret: config.threadsAppSecret,
      grant_type: "authorization_code",
      redirect_uri: config.threadsRedirectUri,
      code,
    },
    "Threads token exchange"
  );
  return exchangeLongLived(
    THREADS_EXCHANGE_URL,
    "th_exchange_token",
    config.threadsAppSecret,
    short.access_token,
    "Threads long-lived token exchange"
  );
}

export async function fetchThreadsProfile(
  accessToken: string
): Promise<MetaProfile> {
  const u = new URL(THREADS_PROFILE_URL);
  u.searchParams.set("fields", "id,username");
  const res = await fetch(u, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) await throwMetaError("Threads profile fetch", res);
  const json = (await res.json()) as MetaProfile;
  if (!json.id || !json.username)
    throw new Error("Threads profile fetch: missing id/username");
  return { id: String(json.id), username: json.username };
}

/** Full Instagram code → short-lived → 60-day long-lived token exchange. */
export async function instagramExchangeCode(
  code: string
): Promise<MetaTokenSet> {
  // Meta appends a "#_" fragment to the code; strip it before exchanging.
  const cleanCode = code.replace(/#_$/, "");
  const short = await postForm(
    IG_TOKEN_URL,
    {
      client_id: config.igAppId,
      client_secret: config.igAppSecret,
      grant_type: "authorization_code",
      redirect_uri: config.igRedirectUri,
      code: cleanCode,
    },
    "Instagram token exchange"
  );
  return exchangeLongLived(
    IG_EXCHANGE_URL,
    "ig_exchange_token",
    config.igAppSecret,
    short.access_token,
    "Instagram long-lived token exchange"
  );
}

export async function fetchInstagramProfile(
  accessToken: string
): Promise<MetaProfile> {
  const u = new URL(IG_PROFILE_URL);
  u.searchParams.set("fields", "id,username");
  u.searchParams.set("access_token", accessToken);
  const res = await fetch(u);
  if (!res.ok) await throwMetaError("Instagram profile fetch", res);
  const json = (await res.json()) as MetaProfile;
  if (!json.id || !json.username)
    throw new Error("Instagram profile fetch: missing id/username");
  return { id: String(json.id), username: json.username };
}
