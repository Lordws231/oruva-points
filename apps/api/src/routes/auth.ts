import { Router } from "express";
import {
  newPkce,
  authorizeUrl,
  exchangeCode,
  fetchXProfile,
} from "../x.js";
import { config } from "../config.js";
import { upsertUser, getUser } from "../db.js";
import {
  setSessionCookie,
  clearSessionCookie,
  optionalAuth,
} from "../session.js";

export const authRouter = Router();

/** In-memory PKCE store (MVP: single instance; use Redis for multi-instance). */
const pkceStore = new Map<string, { verifier: string; exp: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pkceStore) if (v.exp < now) pkceStore.delete(k);
}, 60_000).unref();

authRouter.get("/x", (_req, res) => {
  if (!config.xClientId) {
    res.status(500).json({
      error:
        "X_CLIENT_ID not configured. Set X_CLIENT_ID / X_CLIENT_SECRET / X_REDIRECT_URI in the API .env (see .env.example).",
    });
    return;
  }
  const pkce = newPkce();
  pkceStore.set(pkce.state, { verifier: pkce.verifier, exp: Date.now() + 10 * 60_000 });
  res.json({ authorizeUrl: authorizeUrl(pkce) });
});

authRouter.get("/x/callback", async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };
  if (!code || !state) {
    res.status(400).json({ error: "missing code/state" });
    return;
  }
  const saved = pkceStore.get(state);
  pkceStore.delete(state);
  if (!saved) {
    res.status(400).json({ error: "invalid or expired state" });
    return;
  }
  try {
    const tokens = await exchangeCode(code, saved.verifier);
    const profile = await fetchXProfile(tokens.access_token);
    // X verification status: verified_type "none" (or absent) means not
    // verified. Refreshed on every login; NULL in the DB = unverified.
    const xVerified =
      (profile.verified_type != null && profile.verified_type !== "none") ||
      profile.verified === true;
    upsertUser(
      profile.id,
      profile.username,
      profile.profile_image_url ?? null,
      xVerified
    );
    setSessionCookie(res, profile.id);
    // Hand back to the web app with the profile in the redirect.
    res.redirect(
      `${config.webUrl}/tasks?connected=1&username=${encodeURIComponent(
        profile.username
      )}`
    );
  } catch (err) {
    res.status(502).json({
      error: "X OAuth failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

authRouter.get("/me", (req, res) => {
  const xUserId = optionalAuth(req);
  if (!xUserId) {
    res.json({ user: null });
    return;
  }
  const user = getUser(xUserId);
  res.json({
    user: user
      ? { ...user, xVerified: user.x_verified === 1 }
      : null,
  });
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});
