/**
 * Signed httpOnly session cookie via node:crypto HMAC-SHA256.
 * Payload: { sub: x_user_id, iat, exp } — base64url JSON + hex signature.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";

export const SESSION_COOKIE = "orv_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function b64urlEncode(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", config.sessionSecret).update(data).digest("hex");
}

export function createSession(xUserId: string): string {
  const payload = JSON.stringify({
    sub: xUserId,
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
  });
  const body = b64urlEncode(payload);
  return `${body}.${sign(body)}`;
}

export function verifySession(token: string): string | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as { sub: string; exp: number };
    if (typeof payload.sub !== "string" || payload.exp < Date.now())
      return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, xUserId: string): void {
  // Production serves the web app and API on different origins (cross-site),
  // so the cookie needs SameSite=None; Secure to be sent with API requests.
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(SESSION_COOKIE, createSession(xUserId), {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie(SESSION_COOKIE, {
    path: "/",
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
  });
}

export interface AuthedRequest extends Request {
  xUserId?: string;
}

/** Express middleware — attaches req.xUserId or 401s. */
export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const sub = token ? verifySession(token) : null;
  if (!sub) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  req.xUserId = sub;
  next();
}

/** Non-throwing: returns user id or null. */
export function optionalAuth(req: Request): string | null {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  return token ? verifySession(token) : null;
}
