/**
 * Environment configuration. All secrets via env only — nothing hardcoded.
 * Loads apps/api/.env via dotenv (cwd is the package dir under npm workspaces).
 */
import "dotenv/config";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

export const config = {
  port: parseInt(process.env.PORT ?? "8787", 10),
  sessionSecret: req("SESSION_SECRET"),
  databasePath: process.env.DATABASE_PATH ?? "./data/oruva.db",

  webUrl: process.env.WEB_URL ?? "http://localhost:5173",

  // X (Twitter) OAuth 2.0
  xClientId: process.env.X_CLIENT_ID ?? "",
  xClientSecret: process.env.X_CLIENT_SECRET ?? "",
  xRedirectUri:
    process.env.X_REDIRECT_URI ??
    "http://localhost:8787/api/auth/x/callback",
  /** App-level bearer token for follow verification; optional (see x.ts). */
  xBearerToken: process.env.X_BEARER_TOKEN ?? "",
  /** Numeric X user IDs of the accounts to follow (env, not hardcoded). */
  xOruvaUserId: process.env.X_ORUVA_USER_ID ?? "",
  xFounderUserId: process.env.X_FOUNDER_USER_ID ?? "",

  // Solana
  solanaRpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  solanaCluster: process.env.SOLANA_CLUSTER ?? "devnet",
  orvaMint: process.env.ORVA_MINT ?? "",
  orvaPerEpoch: parseInt(
    process.env.ORVA_PER_EPOCH ?? String(1_000_000),
    10
  ),
  distributorSecretKey: process.env.DISTRIBUTOR_SECRET_KEY ?? "",
  /** Where unclaimed allocation goes after the claim window closes. */
  treasuryWallet: process.env.TREASURY_WALLET ?? "",

  /**
   * Shared secret for the Instagram follow-bot worker's admin endpoints
   * (x-admin-key header). Empty = admin endpoints disabled.
   */
  adminKey: process.env.ADMIN_KEY ?? "",
};
