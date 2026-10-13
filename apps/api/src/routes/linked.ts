/**
 * Instagram + Threads account linking (Meta OAuth).
 *
 *   GET  /api/auth/threads            → 302 to Threads authorize (login required)
 *   GET  /api/auth/threads/callback   → validate state, exchange code,
 *                                       link account, redirect to web app
 *   GET  /api/auth/instagram          → 302 to Instagram authorize (login required)
 *   GET  /api/auth/instagram/callback → same flow for Instagram
 *   GET  /api/auth/linked             → linked accounts for the session user
 *   POST /api/auth/linked/:provider/disconnect → unlink
 *
 * Errors redirect back to the web app with ?link_error=<provider|denied>.
 * Access tokens are stored but never logged or returned by any endpoint.
 */
import { Router } from "express";
import { randomBytes } from "node:crypto";
import { config } from "../config.js";
import {
  requireAuth,
  optionalAuth,
  type AuthedRequest,
} from "../session.js";
import {
  threadsConfigured,
  threadsAuthorizeUrl,
  threadsExchangeCode,
  fetchThreadsProfile,
  instagramConfigured,
  instagramAuthorizeUrl,
  instagramExchangeCode,
  fetchInstagramProfile,
} from "../meta.js";
import {
  upsertLinkedAccount,
  listLinkedAccounts,
  deleteLinkedAccount,
  type LinkedProvider,
} from "../db.js";

export const linkedRouter = Router();

const PROVIDERS = ["threads", "instagram"] as const;
type Provider = (typeof PROVIDERS)[number];

/** One-shot OAuth state store: state → { xUserId, provider }. */
const stateStore = new Map<
  string,
  { xUserId: string; provider: Provider; exp: number }
>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of stateStore) if (v.exp < now) stateStore.delete(k);
}, 60_000).unref();

function newState(xUserId: string, provider: Provider): string {
  const state = randomBytes(16).toString("hex");
  stateStore.set(state, {
    xUserId,
    provider,
    exp: Date.now() + 10 * 60_000,
  });
  return state;
}

function redirectWithError(res: import("express").Response, reason: string) {
  res.redirect(
    `${config.webUrl}/tasks?link_error=${encodeURIComponent(reason)}`
  );
}

function redirectLinked(res: import("express").Response, provider: Provider) {
  res.redirect(`${config.webUrl}/tasks?linked=${encodeURIComponent(provider)}`);
}

function startLink(provider: Provider) {
  return (req: AuthedRequest, res: import("express").Response) => {
    const configured =
      provider === "threads" ? threadsConfigured() : instagramConfigured();
    if (!configured) {
      redirectWithError(res, `${provider}-not-configured`);
      return;
    }
    const state = newState(req.xUserId!, provider);
    const url =
      provider === "threads"
        ? threadsAuthorizeUrl(state)
        : instagramAuthorizeUrl(state);
    res.redirect(url);
  };
}

linkedRouter.get("/threads", requireAuth, startLink("threads"));
linkedRouter.get("/instagram", requireAuth, startLink("instagram"));

function handleCallback(provider: Provider) {
  return async (req: import("express").Request, res: import("express").Response) => {
    const q = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };
    if (q.error) {
      redirectWithError(res, "denied");
      return;
    }
    if (!q.code || !q.state) {
      redirectWithError(res, `${provider}-missing-code`);
      return;
    }
    const saved = stateStore.get(q.state);
    stateStore.delete(q.state);
    if (!saved || saved.provider !== provider) {
      redirectWithError(res, `${provider}-bad-state`);
      return;
    }
    // The state binds the link to the user who started it, so a stale or
    // missing session cookie can't attach the account to someone else.
    const sessionUser = optionalAuth(req);
    if (sessionUser && sessionUser !== saved.xUserId) {
      redirectWithError(res, `${provider}-user-mismatch`);
      return;
    }
    try {
      const tokens =
        provider === "threads"
          ? await threadsExchangeCode(q.code)
          : await instagramExchangeCode(q.code);
      const profile =
        provider === "threads"
          ? await fetchThreadsProfile(tokens.accessToken)
          : await fetchInstagramProfile(tokens.accessToken);
      upsertLinkedAccount(
        saved.xUserId,
        provider as LinkedProvider,
        profile.id,
        profile.username,
        tokens.accessToken,
        tokens.expiresAt
      );
      redirectLinked(res, provider);
    } catch (err) {
      console.error(
        `${provider} link failed for user ${saved.xUserId}:`,
        err instanceof Error ? err.message : String(err)
      );
      redirectWithError(res, provider);
    }
  };
}

linkedRouter.get("/threads/callback", handleCallback("threads"));
linkedRouter.get("/instagram/callback", handleCallback("instagram"));

linkedRouter.get("/linked", requireAuth, (req: AuthedRequest, res) => {
  const rows = listLinkedAccounts(req.xUserId!);
  res.json({
    accounts: rows.map((r) => ({
      provider: r.provider,
      username: r.username,
      linkedAt: r.updated_at,
    })),
  });
});

linkedRouter.post(
  "/linked/:provider/disconnect",
  requireAuth,
  (req: AuthedRequest, res) => {
    const provider = req.params.provider as string;
    if (!PROVIDERS.includes(provider as Provider)) {
      res.status(400).json({ error: "unknown provider" });
      return;
    }
    deleteLinkedAccount(req.xUserId!, provider as LinkedProvider);
    res.json({ ok: true });
  }
);
