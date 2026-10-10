/** Minimal cookie parser (avoids an extra dependency). */
export function parseCookies(
  header: string | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

// Express's bundled types don't include req.cookies (that comes from
// cookie-parser). We attach our own parsed cookies in index.ts.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      cookies?: Record<string, string>;
    }
  }
}
