/**
 * SQLite storage via node:sqlite (Node >= 22.5).
 * Single ledger table `tasks_completed` records every point award
 * (follow tasks + location pins); `location_pins` stores the geo detail.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.js";
import { seasonEpochIds } from "@oruva/shared";

mkdirSync(dirname(config.databasePath), { recursive: true });

export const db = new DatabaseSync(config.databasePath);

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    x_user_id    TEXT PRIMARY KEY,
    username     TEXT NOT NULL,
    avatar       TEXT,
    wallet_address TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS tasks_completed (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    x_user_id  TEXT NOT NULL REFERENCES users(x_user_id),
    task_id    TEXT NOT NULL,
    epoch      TEXT NOT NULL,
    points     INTEGER NOT NULL,
    verified   INTEGER NOT NULL DEFAULT 0,
    note       TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (x_user_id, task_id)
  );
  CREATE TABLE IF NOT EXISTS location_pins (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    x_user_id  TEXT NOT NULL REFERENCES users(x_user_id),
    lat        REAL NOT NULL,
    lng        REAL NOT NULL,
    city       TEXT,
    epoch      TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS epochs (
    id          TEXT PRIMARY KEY,
    starts_at   TEXT NOT NULL,
    ends_at     TEXT NOT NULL,
    finalized   INTEGER NOT NULL DEFAULT 0,
    total_points INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS claims (
    x_user_id  TEXT NOT NULL REFERENCES users(x_user_id),
    epoch      TEXT NOT NULL,
    points     INTEGER NOT NULL,
    tokens     INTEGER NOT NULL,
    tx_sig     TEXT,
    claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (x_user_id, epoch)
  );
  -- Instagram follow bot: cached follower snapshot of @oruvatransport,
  -- globally-claimed usernames (one username earns FOLLOW_INSTAGRAM once,
  -- first-come), and pending bio-code ownership checks.
  CREATE TABLE IF NOT EXISTS ig_followers_snapshot (
    username   TEXT PRIMARY KEY,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS ig_snapshot_meta (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    fetched_at     TEXT NOT NULL DEFAULT (datetime('now')),
    follower_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS instagram_follows (
    username    TEXT PRIMARY KEY,
    x_user_id   TEXT NOT NULL REFERENCES users(x_user_id),
    verified_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS instagram_pending (
    x_user_id  TEXT PRIMARY KEY REFERENCES users(x_user_id),
    username   TEXT NOT NULL,
    code       TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending',
    expires_at TEXT NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ---------------------------------------------------------------- helpers

type SqlRow = Record<string, unknown>;

/** Cast helpers: node:sqlite returns loose Record types. */
function asRow<T>(v: SqlRow | undefined): T | undefined {
  return v as T | undefined;
}
function asRows<T>(v: SqlRow[]): T[] {
  return v as T[];
}

// ---------------------------------------------------------------- users

// Migration (engagement milestones): X verification status on users.
// NULL = never checked yet; treated as unverified.
const _userCols = db
  .prepare(`PRAGMA table_info(users)`)
  .all() as { name: string }[];
if (!_userCols.some((c) => c.name === "x_verified")) {
  db.exec(`ALTER TABLE users ADD COLUMN x_verified INTEGER NULL`);
}

export interface UserRow {
  x_user_id: string;
  username: string;
  avatar: string | null;
  wallet_address: string | null;
  x_verified: number | null;
  created_at: string;
}

export function upsertUser(
  xUserId: string,
  username: string,
  avatar: string | null,
  verified: boolean | null = null
): void {
  db.prepare(
    `INSERT INTO users (x_user_id, username, avatar, x_verified)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(x_user_id) DO UPDATE SET
       username = excluded.username,
       avatar = excluded.avatar,
       x_verified = excluded.x_verified`
  ).run(
    xUserId,
    username,
    avatar,
    verified === null ? null : verified ? 1 : 0
  );
}

export function getUser(xUserId: string): UserRow | undefined {
  const r = db
    .prepare(`SELECT * FROM users WHERE x_user_id = ?`)
    .get(xUserId);
  return asRow<UserRow>(r);
}

export function setWallet(xUserId: string, wallet: string): void {
  db.prepare(`UPDATE users SET wallet_address = ? WHERE x_user_id = ?`).run(
    wallet,
    xUserId
  );
}

// ---------------------------------------------------------------- points ledger

export interface CompletionRow {
  id: number;
  x_user_id: string;
  task_id: string;
  epoch: string;
  points: number;
  verified: number;
  note: string | null;
  created_at: string;
}

/**
 * Award a ONE-TIME task. Idempotent: returns null if already completed.
 */
export function awardOnce(
  xUserId: string,
  taskId: string,
  epoch: string,
  points: number,
  verified: boolean,
  note?: string
): CompletionRow | null {
  const res = db
    .prepare(
      `INSERT OR IGNORE INTO tasks_completed
         (x_user_id, task_id, epoch, points, verified, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(xUserId, taskId, epoch, points, verified ? 1 : 0, note ?? null);
  if (Number(res.changes) === 0) return null; // already completed (idempotent)
  const r = db
    .prepare(`SELECT * FROM tasks_completed WHERE id = ?`)
    .get(Number(res.lastInsertRowid));
  return asRow<CompletionRow>(r)!;
}

export function hasCompletedOnce(xUserId: string, taskId: string): boolean {
  const r = db
    .prepare(
      `SELECT 1 FROM tasks_completed WHERE x_user_id = ? AND task_id = ? LIMIT 1`
    )
    .get(xUserId, taskId);
  return r !== undefined;
}

/** All completions for a user (task statuses). */
export function userCompletions(xUserId: string): CompletionRow[] {
  const r = db
    .prepare(`SELECT * FROM tasks_completed WHERE x_user_id = ? ORDER BY id`)
    .all(xUserId);
  return asRows<CompletionRow>(r);
}

/** Points earned by a user in an epoch. */
export function userEpochPoints(xUserId: string, epoch: string): number {
  const r = db
    .prepare(
      `SELECT COALESCE(SUM(points), 0) AS total
       FROM tasks_completed WHERE x_user_id = ? AND epoch = ?`
    )
    .get(xUserId, epoch) as { total: number } | undefined;
  return r?.total ?? 0;
}

/** Lifetime points for a user across all epochs. */
export function lifetimePoints(xUserId: string): number {
  const r = db
    .prepare(
      `SELECT COALESCE(SUM(points), 0) AS total
       FROM tasks_completed WHERE x_user_id = ?`
    )
    .get(xUserId) as { total: number } | undefined;
  return r?.total ?? 0;
}

/** Total points across all users in an epoch (live or snapshot). */
export function epochTotalPoints(epoch: string): number {
  const r = db
    .prepare(
      `SELECT COALESCE(SUM(points), 0) AS total
       FROM tasks_completed WHERE epoch = ?`
    )
    .get(epoch) as { total: number } | undefined;
  return r?.total ?? 0;
}

// ---------------------------------------------------------------- location pins

export interface PinRow {
  id: number;
  x_user_id: string;
  lat: number;
  lng: number;
  city: string | null;
  epoch: string;
  created_at: string;
}

export function insertPin(
  xUserId: string,
  lat: number,
  lng: number,
  city: string | null,
  epoch: string,
  points: number
): PinRow {
  db.exec("BEGIN IMMEDIATE");
  try {
    const pin = db
      .prepare(
        `INSERT INTO location_pins (x_user_id, lat, lng, city, epoch)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(xUserId, lat, lng, city, epoch);
    const pinId = Number(pin.lastInsertRowid);
    // Ledger row with a unique task_id so pins stay repeatable.
    db.prepare(
      `INSERT INTO tasks_completed (x_user_id, task_id, epoch, points, verified, note)
       VALUES (?, ?, ?, ?, 1, ?)`
    ).run(xUserId, `LOCATION_PIN:${pinId}`, epoch, points, `pin ${pinId}`);
    const r = db
      .prepare(`SELECT * FROM location_pins WHERE id = ?`)
      .get(pinId);
    db.exec("COMMIT");
    return asRow<PinRow>(r)!;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function userPins(xUserId: string, limit = 50): PinRow[] {
  const r = db
    .prepare(
      `SELECT * FROM location_pins WHERE x_user_id = ? ORDER BY id DESC LIMIT ?`
    )
    .all(xUserId, limit);
  return asRows<PinRow>(r);
}

/** Most recent pin (for the 100 m dedupe check). */
export function lastPin(xUserId: string): PinRow | undefined {
  const r = db
    .prepare(
      `SELECT * FROM location_pins WHERE x_user_id = ? ORDER BY id DESC LIMIT 1`
    )
    .get(xUserId);
  return asRow<PinRow>(r);
}

/** Pins shared today (UTC day) — enforces the 10/day cap. */
export function pinsToday(xUserId: string): number {
  const r = db
    .prepare(
      `SELECT COUNT(*) AS n FROM location_pins
       WHERE x_user_id = ? AND date(created_at) = date('now')`
    )
    .get(xUserId) as { n: number } | undefined;
  return r?.n ?? 0;
}

// ---------------------------------------------------------------- hashtag posts
// Hashtag posts are repeatable: each completion gets a unique task_id
// `HASHTAG_POST:<tweetId>`, so the UNIQUE(x_user_id, task_id) constraint
// doubles as the dedupe guard — a tweet can never be claimed twice.

/** Unique ledger task_id for a claimed tweet (dedupe key). */
export function hashtagTaskId(tweetId: string): string {
  return `HASHTAG_POST:${tweetId}`;
}

/** True if the user already claimed points for this tweet. */
export function hasClaimedTweet(xUserId: string, tweetId: string): boolean {
  const r = db
    .prepare(
      `SELECT 1 FROM tasks_completed WHERE x_user_id = ? AND task_id = ? LIMIT 1`
    )
    .get(xUserId, hashtagTaskId(tweetId));
  return r !== undefined;
}

// ---------------------------------------------------------------- engagement milestones
// Same dedupe pattern as hashtag posts: each milestone claim gets a unique
// ledger task_id `<TASK_ID>:<tweetId>`, so the UNIQUE(x_user_id, task_id)
// constraint makes a double-claim impossible at the DB level.

/** Unique ledger task_id for an engagement milestone claim (dedupe key). */
export function engagementTaskId(taskId: string, tweetId: string): string {
  return `${taskId}:${tweetId}`;
}

// ---------------------------------------------------------------- epochs & claims

export interface EpochRow {
  id: string;
  starts_at: string;
  ends_at: string;
  finalized: number;
  total_points: number;
}

export function upsertEpoch(id: string, startsAt: Date, endsAt: Date): void {
  db.prepare(
    `INSERT INTO epochs (id, starts_at, ends_at)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET ends_at = excluded.ends_at`
  ).run(id, startsAt.toISOString(), endsAt.toISOString());
}

export function getEpoch(id: string): EpochRow | undefined {
  const r = db.prepare(`SELECT * FROM epochs WHERE id = ?`).get(id);
  return asRow<EpochRow>(r);
}

export function finalizeEpoch(id: string, totalPoints: number): void {
  db.prepare(
    `UPDATE epochs SET finalized = 1, total_points = ? WHERE id = ?`
  ).run(totalPoints, id);
}

export function listEpochs(limit = 12): EpochRow[] {
  const r = db
    .prepare(`SELECT * FROM epochs ORDER BY id DESC LIMIT ?`)
    .all(limit);
  return asRows<EpochRow>(r);
}

export interface ClaimRow {
  x_user_id: string;
  epoch: string;
  points: number;
  tokens: number;
  tx_sig: string | null;
  claimed_at: string;
}

export function getClaim(xUserId: string, epoch: string): ClaimRow | undefined {
  const r = db
    .prepare(`SELECT * FROM claims WHERE x_user_id = ? AND epoch = ?`)
    .get(xUserId, epoch);
  return asRow<ClaimRow>(r);
}

export function insertClaim(
  xUserId: string,
  epoch: string,
  points: number,
  tokens: number,
  txSig: string
): ClaimRow {
  db.prepare(
    `INSERT INTO claims (x_user_id, epoch, points, tokens, tx_sig)
     VALUES (?, ?, ?, ?, ?)`
  ).run(xUserId, epoch, points, tokens, txSig);
  return getClaim(xUserId, epoch)!;
}

/** Epochs with finalized points the user earned but hasn't claimed. */
export function claimableEpochs(xUserId: string): EpochRow[] {
  const r = db
    .prepare(
      `SELECT e.* FROM epochs e
       WHERE e.finalized = 1
         AND EXISTS (
           SELECT 1 FROM tasks_completed t
           WHERE t.x_user_id = ? AND t.epoch = e.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM claims c
           WHERE c.x_user_id = ? AND c.epoch = e.id
         )
       ORDER BY e.id DESC`
    )
    .all(xUserId, xUserId);
  return asRows<EpochRow>(r);
}

// ---------------------------------------------------------------- seasons
// Season claims are recorded in the `claims` table with epoch = "SEASON:<id>"
// (e.g. "SEASON:1"). The PRIMARY KEY (x_user_id, epoch) then enforces one
// claim per user per season. Weekly epoch ids ("YYYY-MM-DD") live in a
// disjoint namespace, so the two can never collide.

/** Points earned by a user across all weeks of a season. */
export function seasonUserPoints(xUserId: string, seasonId: number): number {
  const ids = seasonEpochIds(seasonId);
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(",");
  const r = db
    .prepare(
      `SELECT COALESCE(SUM(points), 0) AS total
       FROM tasks_completed WHERE x_user_id = ? AND epoch IN (${placeholders})`
    )
    .get(xUserId, ...ids) as { total: number } | undefined;
  return r?.total ?? 0;
}

/** Total points across all users for a season (live sum over its weeks). */
export function seasonTotalPoints(seasonId: number): number {
  const ids = seasonEpochIds(seasonId);
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(",");
  const r = db
    .prepare(
      `SELECT COALESCE(SUM(points), 0) AS total
       FROM tasks_completed WHERE epoch IN (${placeholders})`
    )
    .get(...ids) as { total: number } | undefined;
  return r?.total ?? 0;
}

/** Season leaderboard: points summed across the season's weeks. */
export function seasonLeaderboard(
  seasonId: number,
  limit = 50
): LeaderRow[] {
  const ids = seasonEpochIds(seasonId);
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const r = db
    .prepare(
      `SELECT u.x_user_id, u.username, u.avatar,
              COALESCE(SUM(t.points), 0) AS points
       FROM tasks_completed t
       JOIN users u ON u.x_user_id = t.x_user_id
       WHERE t.epoch IN (${placeholders})
       GROUP BY u.x_user_id
       ORDER BY points DESC, u.created_at ASC
       LIMIT ?`
    )
    .all(...ids, limit);
  return asRows<LeaderRow>(r);
}

// ---------------------------------------------------------------- instagram follow bot

export interface IgSnapshotMeta {
  fetched_at: string;
  follower_count: number;
}

/** Replace the cached @oruvatransport follower snapshot (worker-driven). */
export function replaceFollowerSnapshot(usernames: string[]): void {
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`DELETE FROM ig_followers_snapshot`).run();
    const ins = db.prepare(
      `INSERT OR IGNORE INTO ig_followers_snapshot (username, fetched_at) VALUES (?, ?)`
    );
    for (const u of usernames) ins.run(u.toLowerCase(), now);
    db.prepare(
      `INSERT INTO ig_snapshot_meta (id, fetched_at, follower_count)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET fetched_at = excluded.fetched_at,
                                     follower_count = excluded.follower_count`
    ).run(now, usernames.length);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function getSnapshotMeta(): IgSnapshotMeta | undefined {
  const r = db
    .prepare(`SELECT fetched_at, follower_count FROM ig_snapshot_meta WHERE id = 1`)
    .get();
  return asRow<IgSnapshotMeta>(r);
}

/** True if the (lowercased) username is in the cached follower snapshot. */
export function isSnapshotFollower(username: string): boolean {
  const r = db
    .prepare(`SELECT 1 FROM ig_followers_snapshot WHERE username = ? LIMIT 1`)
    .get(username.toLowerCase());
  return r !== undefined;
}

/** True if this Instagram username already earned FOLLOW_INSTAGRAM (global). */
export function isInstagramUsernameClaimed(username: string): boolean {
  const r = db
    .prepare(`SELECT 1 FROM instagram_follows WHERE username = ? LIMIT 1`)
    .get(username.toLowerCase());
  return r !== undefined;
}

/**
 * Record a verified Instagram follow. Returns false if the username was
 * already claimed (first-come wins — enforced at the DB level).
 */
export function claimInstagramUsername(
  username: string,
  xUserId: string
): boolean {
  const res = db
    .prepare(
      `INSERT OR IGNORE INTO instagram_follows (username, x_user_id)
       VALUES (?, ?)`
    )
    .run(username.toLowerCase(), xUserId);
  return Number(res.changes) === 1;
}

export interface IgPendingRow {
  x_user_id: string;
  username: string;
  code: string;
  status: string;
  expires_at: string;
  attempts: number;
  created_at: string;
}

export function createInstagramPending(
  xUserId: string,
  username: string,
  code: string,
  expiresAt: string
): void {
  db.prepare(
    `INSERT INTO instagram_pending (x_user_id, username, code, status, expires_at, attempts)
     VALUES (?, ?, ?, 'pending', ?, 0)
     ON CONFLICT(x_user_id) DO UPDATE SET
       username = excluded.username,
       code = excluded.code,
       status = 'pending',
       expires_at = excluded.expires_at,
       attempts = 0,
       created_at = datetime('now')`
  ).run(xUserId, username.toLowerCase(), code, expiresAt);
}

export function getInstagramPending(
  xUserId: string
): IgPendingRow | undefined {
  const r = db
    .prepare(`SELECT * FROM instagram_pending WHERE x_user_id = ?`)
    .get(xUserId);
  return asRow<IgPendingRow>(r);
}

export function setInstagramPendingStatus(
  xUserId: string,
  status: string
): void {
  db.prepare(
    `UPDATE instagram_pending SET status = ? WHERE x_user_id = ?`
  ).run(status, xUserId);
}

export function bumpInstagramPendingAttempts(xUserId: string): number {
  db.prepare(
    `UPDATE instagram_pending SET attempts = attempts + 1 WHERE x_user_id = ?`
  ).run(xUserId);
  return getInstagramPending(xUserId)?.attempts ?? 0;
}

export function deleteInstagramPending(xUserId: string): void {
  db.prepare(`DELETE FROM instagram_pending WHERE x_user_id = ?`).run(xUserId);
}

/** Pending bio-code checks ready for the worker (awaiting, unexpired). */
export function listAwaitingInstagramChecks(): IgPendingRow[] {
  const r = db
    .prepare(
      `SELECT * FROM instagram_pending
       WHERE status = 'awaiting_check' AND datetime(expires_at) > datetime('now')
       ORDER BY created_at ASC`
    )
    .all();
  return asRows<IgPendingRow>(r);
}

// ---------------------------------------------------------------- leaderboard

export interface LeaderRow {
  x_user_id: string;
  username: string;
  avatar: string | null;
  points: number;
}

export function leaderboard(epoch: string, limit = 50): LeaderRow[] {
  const r = db
    .prepare(
      `SELECT u.x_user_id, u.username, u.avatar,
              COALESCE(SUM(t.points), 0) AS points
       FROM tasks_completed t
       JOIN users u ON u.x_user_id = t.x_user_id
       WHERE t.epoch = ?
       GROUP BY u.x_user_id
       ORDER BY points DESC, u.created_at ASC
       LIMIT ?`
    )
    .all(epoch, limit);
  return asRows<LeaderRow>(r);
}
