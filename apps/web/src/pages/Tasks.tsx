import { useCallback, useEffect, useState } from "react";
import {
  CAMPAIGN_HASHTAGS,
  ENGAGEMENT_MILESTONES,
  describeMilestone,
  taskById,
} from "@oruva/shared";
import { api, ApiError, authConnectUrl } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { TaskDef, Pin, LinkedAccount } from "../lib/types";
import GoogleMapsPicker from "../components/GoogleMapsPicker";
import OsmMapPicker from "../components/OsmMapPicker";

const MAPS_KEY: string | undefined = import.meta.env
  .VITE_GOOGLE_MAPS_API_KEY as string | undefined;

interface EngMetrics {
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
}

type EngCheckResult =
  | {
      kind: "result";
      data: {
        ok: boolean;
        tier: "verified" | "unverified";
        awarded: { taskId: string; name: string; points: number }[];
        alreadyClaimed: string[];
        notMet: string[];
        totalPoints: number;
        metrics: EngMetrics;
      };
    }
  | { kind: "pending"; message: string };

/** Linked Instagram + Threads accounts (Meta OAuth). */
function LinkedAccounts() {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.linked();
      setAccounts(r.accounts);
    } catch {
      /* ignore until linked */
    }
  }, []);

  useEffect(() => {
    load();
    // One-shot feedback from the OAuth callback redirect.
    const params = new URLSearchParams(window.location.search);
    const linked = params.get("linked");
    const err = params.get("link_error");
    if (linked === "threads" || linked === "instagram" || linked === "facebook") {
      setNote(
        `✓ ${linked === "threads" ? "Threads" : linked === "facebook" ? "Facebook" : "Instagram"} account connected.`
      );
    } else if (err) {
      setNote(
        err === "denied"
          ? "Connection cancelled — no account was linked."
          : "Couldn't connect that account — please try again."
      );
    }
    if (linked || err) {
      params.delete("linked");
      params.delete("link_error");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}`
      );
    }
  }, [load]);

  async function disconnect(provider: "instagram" | "threads" | "facebook") {
    setBusy(provider);
    try {
      await api.disconnectLinked(provider);
      await load();
    } catch {
      setNote("Couldn't disconnect — please try again.");
    } finally {
      setBusy(null);
    }
  }

  const byProvider = (p: "instagram" | "threads" | "facebook") =>
    accounts.find((a) => a.provider === p);

  return (
    <section className="rounded-2xl border border-navy-700 bg-navy-900 p-6">
      <h2 className="text-xl font-bold">Linked accounts</h2>
      <p className="mt-1 text-sm text-slate-400">
        Connect your Instagram, Threads and Facebook accounts to unlock
        verified social tasks. Facebook linking is how we verify your Page
        follow before points are awarded. You stay signed in here — this
        only links the accounts.
      </p>
      {note && (
        <div className="mt-3 rounded-lg border border-navy-700 bg-navy-950 px-3 py-2 text-sm">
          {note}
        </div>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {(["instagram", "threads", "facebook"] as const).map((p) => {
          const acc = byProvider(p);
          const label = p === "instagram" ? "Instagram" : p === "facebook" ? "Facebook" : "Threads";
          return (
            <div
              key={p}
              className="rounded-xl border border-navy-700 bg-navy-950 p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{label}</h3>
                {acc ? (
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                    Connected
                  </span>
                ) : (
                  <span className="rounded-full bg-navy-900 px-2.5 py-1 text-xs font-semibold text-slate-400">
                    Not connected
                  </span>
                )}
              </div>
              {acc ? (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-slate-300">
                    {p === "facebook" ? acc.username : `@${acc.username}`}
                  </span>
                  <button
                    disabled={busy === p}
                    onClick={() => disconnect(p)}
                    className="rounded-lg border border-navy-700 px-3 py-1.5 text-sm font-semibold hover:border-ember-500 disabled:opacity-50"
                  >
                    {busy === p ? "…" : "Disconnect"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    window.location.href = authConnectUrl(p);
                  }}
                  className="mt-3 w-full rounded-lg bg-ember-500 px-3 py-2 text-sm font-bold text-navy-950 hover:bg-ember-400"
                >
                  Connect {label}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        The Meta app must be approved for the Facebook user_likes permission
        before public users can complete the Facebook connection.
      </p>
    </section>
  );
}

/** Instagram follow task: username entry -> bio-code -> bot verification. */
function IgFollowBody({
  task,
  refresh,
}: {
  task: TaskDef;
  refresh: () => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "code" | "checking">("idle");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Resume a pending claim (e.g. user reloaded mid-flow).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.instagramFollowStatus();
        if (cancelled) return;
        if (s.state === "pending" && s.code) {
          setCode(s.code);
          if (s.username) setUsername(s.username);
          setPhase("code");
        } else if (s.state === "checking") {
          setPhase("checking");
        }
      } catch {
        /* no pending claim */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll while the bot checks the bio.
  useEffect(() => {
    if (phase !== "checking") return;
    const t = setInterval(async () => {
      try {
        const s = await api.instagramFollowStatus();
        if (s.state === "done") {
          clearInterval(t);
          setPhase("idle");
          setCode(null);
          await refresh();
        } else if (
          s.state === "failed" ||
          s.state === "expired" ||
          s.state === "none"
        ) {
          clearInterval(t);
          setPhase("idle");
          setCode(null);
          setMsg(
            s.state === "failed"
              ? "Verification didn't pass — start again for a fresh code."
              : "Your code expired — start again for a fresh one."
          );
        }
      } catch {
        /* keep polling */
      }
    }, 15000);
    return () => clearInterval(t);
  }, [phase, refresh]);

  async function start() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.instagramFollowStart(username.trim());
      if (r.already) {
        await refresh();
        return;
      }
      if (r.code) {
        setCode(r.code);
        setPhase("code");
      }
    } catch (e) {
      setMsg(
        e instanceof ApiError ? `Couldn't start: ${e.message}` : "Failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.instagramFollowVerify();
      if (r.already) {
        await refresh();
        return;
      }
      setPhase("checking");
    } catch (e) {
      setMsg(
        e instanceof ApiError ? `Couldn't verify: ${e.message}` : "Failed."
      );
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (code) navigator.clipboard?.writeText(code).catch(() => {});
  }

  return (
    <>
      <div className="flex items-start justify-between">
        <h3 className="font-bold">{task.title}</h3>
        <span className="rounded-full bg-navy-950 px-2.5 py-1 font-mono text-xs font-bold text-ember-400">
          +{task.points.toLocaleString()}
        </span>
      </div>
      <p className="mt-2 flex-1 text-sm text-slate-400">{task.description}</p>

      {phase === "idle" && (
        <>
          {task.url && (
            <a
              href={task.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex w-fit items-center justify-center gap-2 rounded-xl bg-ember-500 px-4 py-2.5 text-sm font-bold text-navy-950 shadow transition hover:bg-ember-400 active:scale-[0.99]"
            >
              1. Follow @oruvatransportation on Instagram ↗
            </a>
          )}
          <div className="mt-3 flex gap-2">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="2. Your Instagram username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-navy-700 bg-navy-950 px-3 py-2 text-sm placeholder:text-slate-600 focus:border-ember-500 focus:outline-none"
            />
            <button
              disabled={busy || !username.trim()}
              onClick={start}
              className="shrink-0 rounded-lg bg-ember-500 px-4 py-2 text-sm font-bold text-navy-950 disabled:opacity-50 hover:bg-ember-400"
            >
              {busy ? "Checking…" : "Get code"}
            </button>
          </div>
        </>
      )}

      {phase === "code" && code && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-navy-950 px-3 py-3 text-center">
            <div className="text-xs text-slate-500">
              3. Add this code anywhere in your Instagram bio
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold tracking-widest text-ember-400">
              {code}
            </div>
            <button
              onClick={copyCode}
              className="mt-1 text-xs text-slate-400 underline underline-offset-2"
            >
              copy code
            </button>
          </div>
          <button
            disabled={busy}
            onClick={verify}
            className="w-full rounded-lg bg-ember-500 px-4 py-2 text-sm font-bold text-navy-950 disabled:opacity-50 hover:bg-ember-400"
          >
            {busy ? "Queuing…" : "4. I've added it — Verify"}
          </button>
          <p className="text-xs text-slate-500">
            Code expires in 30 minutes. One Instagram username can only earn
            this once — you can remove the code after verification.
          </p>
        </div>
      )}

      {phase === "checking" && (
        <div className="mt-4 rounded-lg bg-navy-950 px-3 py-3 text-center text-sm text-slate-300">
          Checking your bio… our bot usually confirms within a few minutes.
          You can leave this page — the points land automatically.
        </div>
      )}

      {msg && <p className="mt-3 text-xs text-amber-300">{msg}</p>}
    </>
  );
}


/**
 * Threads + LinkedIn follow tasks: verification-bot code flow.
 * Enter identity → bot confirms the follow → add the one-time code to
 * your profile → bot verifies the code → points land. No self-attestation.
 */
function SocialFollowBody({
  task,
  refresh,
}: {
  task: TaskDef;
  refresh: () => Promise<void>;
}) {
  const isThreads = task.id === "FOLLOW_THREADS";
  const [identity, setIdentity] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [codeTarget, setCodeTarget] = useState<string>(
    isThreads ? "Threads bio" : "LinkedIn About section"
  );
  const [phase, setPhase] = useState<"idle" | "code" | "checking">("idle");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.socialStatus(task.id);
        if (cancelled) return;
        if (s.state === "pending" && s.code) {
          setCode(s.code);
          if (s.username) setIdentity(s.username);
          setPhase("code");
        } else if (s.state === "checking") {
          setPhase("checking");
        }
      } catch {
        /* no pending claim */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  useEffect(() => {
    if (phase !== "checking") return;
    const t = setInterval(async () => {
      try {
        const s = await api.socialStatus(task.id);
        if (s.state === "done") {
          clearInterval(t);
          setPhase("idle");
          setCode(null);
          await refresh();
        } else if (s.state === "failed" || s.state === "expired" || s.state === "none") {
          clearInterval(t);
          setPhase("idle");
          setCode(null);
          setMsg(
            s.state === "failed"
              ? "Verification didn't pass — start again for a fresh code."
              : "Your code expired — start again for a fresh one."
          );
        }
      } catch {
        /* keep polling */
      }
    }, 15000);
    return () => clearInterval(t);
  }, [phase, refresh, task.id]);

  async function start() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.socialStart(
        task.id,
        isThreads
          ? { username: identity.trim() }
          : { profileUrl: identity.trim() }
      );
      if (r.already) {
        await refresh();
        return;
      }
      if (r.code) {
        setCode(r.code);
        if (r.codeTarget) setCodeTarget(r.codeTarget);
        setPhase("code");
      }
    } catch (e) {
      setMsg(e instanceof ApiError ? `Couldn't start: ${e.message}` : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.socialVerify(task.id);
      if (r.already) {
        await refresh();
        return;
      }
      setPhase("checking");
    } catch (e) {
      setMsg(e instanceof ApiError ? `Couldn't verify: ${e.message}` : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (code) navigator.clipboard?.writeText(code).catch(() => {});
  }

  return (
    <>
      <div className="flex items-start justify-between">
        <h3 className="font-bold">{task.title}</h3>
        <span className="rounded-full bg-navy-950 px-2.5 py-1 font-mono text-xs font-bold text-ember-400">
          +{task.points.toLocaleString()}
        </span>
      </div>
      <p className="mt-2 flex-1 text-sm text-slate-400">{task.description}</p>

      {phase === "idle" && (
        <>
          {task.url && (
            <a
              href={task.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex w-fit items-center justify-center gap-2 rounded-xl bg-ember-500 px-4 py-2.5 text-sm font-bold text-navy-950 shadow transition hover:bg-ember-400 active:scale-[0.99]"
            >
              {isThreads
                ? "1. Follow @oruvatransportation on Threads ↗"
                : task.id === "FOLLOW_ORUVA_LINKEDIN"
                  ? "1. Follow Oruva Transportation Services on LinkedIn ↗"
                  : "1. Follow the founder on LinkedIn ↗"}
            </a>
          )}
          <div className="mt-3 flex gap-2">
            <input
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              placeholder={
                isThreads
                  ? "2. Your Threads username"
                  : "2. Your LinkedIn profile URL"
              }
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-navy-700 bg-navy-950 px-3 py-2 text-sm placeholder:text-slate-600 focus:border-ember-500 focus:outline-none"
            />
            <button
              disabled={busy || !identity.trim()}
              onClick={start}
              className="shrink-0 rounded-lg bg-ember-500 px-4 py-2 text-sm font-bold text-navy-950 disabled:opacity-50 hover:bg-ember-400"
            >
              {busy ? "Checking…" : "Get code"}
            </button>
          </div>
        </>
      )}

      {phase === "code" && code && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-navy-950 px-3 py-3 text-center">
            <div className="text-xs text-slate-500">
              3. Add this code anywhere in your {codeTarget}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold tracking-widest text-ember-400">
              {code}
            </div>
            <button
              onClick={copyCode}
              className="mt-1 text-xs text-slate-400 underline underline-offset-2"
            >
              copy code
            </button>
          </div>
          <button
            disabled={busy}
            onClick={verify}
            className="w-full rounded-lg bg-ember-500 px-4 py-2 text-sm font-bold text-navy-950 disabled:opacity-50 hover:bg-ember-400"
          >
            {busy ? "Queuing…" : "4. I've added it — Verify"}
          </button>
          <p className="text-xs text-slate-500">
            Code expires in 30 minutes. Points are awarded only after our
            verification bot confirms your follow and this code — you can
            remove the code after verification.
          </p>
        </div>
      )}

      {phase === "checking" && (
        <div className="mt-4 rounded-lg bg-navy-950 px-3 py-3 text-center text-sm text-slate-300">
          Verifying… our bot usually confirms within a few minutes. You can
          leave this page — the points land automatically once verified.
        </div>
      )}

      {msg && <p className="mt-3 text-xs text-amber-300">{msg}</p>}
    </>
  );
}

/**
 * Facebook follow task: connect Facebook, then a live Graph API check
 * (GET /me/likes/<page>) runs before any points are awarded.
 */
function FacebookFollowBody({
  task,
  refresh,
}: {
  task: TaskDef;
  refresh: () => Promise<void>;
}) {
  const [linkedName, setLinkedName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadLinked = useCallback(async () => {
    try {
      const r = await api.linked();
      const fb = r.accounts.find((a) => a.provider === "facebook");
      setLinkedName(fb ? fb.username : null);
    } catch {
      /* not linked */
    }
  }, []);

  useEffect(() => {
    loadLinked();
  }, [loadLinked]);

  async function verify() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.facebookVerify();
      if (r.ok) {
        setMsg(
          r.already
            ? "Already completed — points were awarded earlier."
            : `Verified ✓ +${r.points?.toLocaleString()} pts earned.`
        );
        await refresh();
      }
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-start justify-between">
        <h3 className="font-bold">{task.title}</h3>
        <span className="rounded-full bg-navy-950 px-2.5 py-1 font-mono text-xs font-bold text-ember-400">
          +{task.points.toLocaleString()}
        </span>
      </div>
      <p className="mt-2 flex-1 text-sm text-slate-400">{task.description}</p>
      {task.url && (
        <a
          href={task.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex w-fit items-center justify-center gap-2 rounded-xl bg-ember-500 px-4 py-2.5 text-sm font-bold text-navy-950 shadow transition hover:bg-ember-400 active:scale-[0.99]"
        >
          1. Follow @Oruvatransport on Facebook ↗
        </a>
      )}
      {linkedName ? (
        <>
          <p className="mt-3 text-xs text-slate-500">
            Facebook connected as {linkedName}. We check your followed Pages
            with Facebook before awarding points.
          </p>
          <button
            disabled={busy}
            onClick={verify}
            className="mt-3 w-full rounded-lg bg-ember-500 px-4 py-2 text-sm font-bold text-navy-950 disabled:opacity-50 hover:bg-ember-400"
          >
            {busy ? "Checking with Facebook…" : "2. Verify follow"}
          </button>
        </>
      ) : (
        <button
          onClick={() => {
            window.location.href = authConnectUrl("facebook");
          }}
          className="mt-4 w-full rounded-lg bg-ember-500 px-4 py-2 text-sm font-bold text-navy-950 hover:bg-ember-400"
        >
          2. Connect Facebook to verify
        </button>
      )}
      {msg && <p className="mt-3 text-xs text-amber-300">{msg}</p>}
    </>
  );
}

export default function Tasks() {
  const { user, loading, connectX } = useAuth();
  const [tasks, setTasks] = useState<TaskDef[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [tweetUrl, setTweetUrl] = useState("");
  const [verifyingHashtag, setVerifyingHashtag] = useState(false);
  const [engUrl, setEngUrl] = useState("");
  const [checkingEng, setCheckingEng] = useState(false);
  const [engResult, setEngResult] = useState<EngCheckResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [submittingPin, setSubmittingPin] = useState(false);
  const [hideFreeMapNote, setHideFreeMapNote] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [{ tasks }, { pins }] = await Promise.all([
        api.tasks(),
        api.myPins(),
      ]);
      setTasks(tasks);
      setPins(pins);
    } catch {
      /* ignore — shown as empty until auth */
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function complete(id: string, confirm = false) {
    setBusy(id);
    setMsg(null);
    try {
      const r = await api.completeTask(id, confirm);
      if (r.ok) {
        setMsg(
          r.already
            ? "Already completed — points were awarded earlier."
            : `+${r.points?.toLocaleString()} pts earned${
                r.verified ? " (verified ✓)" : ""
              }${r.attested ? " (self-attested)" : ""}`
        );
        await load();
      }
    } catch (e) {
      setMsg(
        e instanceof ApiError ? `Couldn't complete: ${e.message}` : "Failed."
      );
    } finally {
      setBusy(null);
    }
  }

  async function verifyHashtag() {
    setVerifyingHashtag(true);
    setMsg(null);
    try {
      const r = await api.completeHashtagPost(tweetUrl.trim());
      if (r.ok) {
        setMsg(
          r.already
            ? "This post was already claimed."
            : `+${r.points?.toLocaleString()} pts earned${
                r.verified ? " (verified ✓)" : ""
              }${r.attested ? " (self-attested)" : ""}`
        );
        setTweetUrl("");
        await load();
      }
    } catch (e) {
      setMsg(
        e instanceof ApiError ? `Couldn't verify: ${e.message}` : "Failed."
      );
    } finally {
      setVerifyingHashtag(false);
    }
  }

  async function checkEngagement() {
    setCheckingEng(true);
    setEngResult(null);
    setMsg(null);
    try {
      const r = await api.completeEngagement(engUrl.trim());
      setEngResult({
        kind: "result",
        data: {
          ok: r.ok,
          tier: r.tier ?? "unverified",
          awarded: r.awarded ?? [],
          alreadyClaimed: r.alreadyClaimed ?? [],
          notMet: r.notMet ?? [],
          totalPoints: r.totalPoints ?? 0,
          metrics: r.metrics ?? {
            retweet_count: 0,
            reply_count: 0,
            like_count: 0,
            quote_count: 0,
          },
        },
      });
      setEngUrl("");
      await load();
    } catch (e) {
      if (e instanceof ApiError) {
        const body = e.body as
          | { status?: string; message?: string }
          | undefined;
        if (e.status === 503 && body?.status === "pending") {
          setEngResult({
            kind: "pending",
            message: body.message ?? e.message,
          });
        } else {
          setMsg(`Couldn't check: ${e.message}`);
        }
      } else {
        setMsg("Failed.");
      }
    } finally {
      setCheckingEng(false);
    }
  }

  async function submitPin(lat: number, lng: number, city?: string) {    setSubmittingPin(true);
    setMsg(null);
    try {
      const r = await api.submitPin(lat, lng, city);
      setMsg(`Pinpoint shared! +${r.points.toLocaleString()} pts earned.`);
      await load();
    } catch (e) {
      setMsg(
        e instanceof ApiError ? `Pin rejected: ${e.message}` : "Failed to share pin."
      );
    } finally {
      setSubmittingPin(false);
    }
  }

  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-navy-700 bg-navy-900 p-10 text-center">
        <h1 className="text-2xl font-bold">Connect to earn points</h1>
        <p className="mt-2 text-slate-400">
          Sign in with X to track your engagement and start earning ORVA.
        </p>
        <button
          onClick={connectX}
          className="mt-6 rounded-xl bg-ember-500 px-7 py-3 font-bold text-navy-950 hover:bg-ember-400"
        >
          Connect with X
        </button>
      </div>
    );
  }

  const followTasks = tasks.filter((t) => t.repeatability === "once");
  const hashtagTask = tasks.find((t) => t.id === "HASHTAG_POST");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold">Tasks</h1>
        <p className="mt-1 text-slate-400">
          Complete tasks to earn points in the current epoch.
        </p>
      </div>

      {msg && (
        <div className="rounded-xl border border-navy-700 bg-navy-900 px-4 py-3 text-sm">
          {msg}
        </div>
      )}

      {/* Follow tasks */}
      <div className="grid gap-4 md:grid-cols-3">
        {followTasks.map((t) =>
          (t.id === "FOLLOW_THREADS" ||
            t.id === "FOLLOW_FOUNDER_LINKEDIN" ||
            t.id === "FOLLOW_ORUVA_LINKEDIN") &&
          !t.completed ? (
            <div
              key={t.id}
              className="flex flex-col rounded-2xl border border-navy-700 bg-navy-900 p-5"
            >
              <SocialFollowBody task={t} refresh={load} />
            </div>
          ) : t.id === "FOLLOW_FACEBOOK" && !t.completed ? (
            <div
              key={t.id}
              className="flex flex-col rounded-2xl border border-navy-700 bg-navy-900 p-5"
            >
              <FacebookFollowBody task={t} refresh={load} />
            </div>
          ) : t.id === "FOLLOW_INSTAGRAM" && !t.completed ? (
            <div
              key={t.id}
              className="flex flex-col rounded-2xl border border-navy-700 bg-navy-900 p-5"
            >
              <IgFollowBody task={t} refresh={load} />
            </div>
          ) : (
            <div
              key={t.id}
              className="flex flex-col rounded-2xl border border-navy-700 bg-navy-900 p-5"
            >
              <div className="flex items-start justify-between">
                <h3 className="font-bold">{t.title}</h3>
                <span className="rounded-full bg-navy-950 px-2.5 py-1 font-mono text-xs font-bold text-ember-400">
                  +{t.points.toLocaleString()}
                </span>
              </div>
              <p className="mt-2 flex-1 text-sm text-slate-400">
                {t.description}
              </p>
              {t.completed ? (
                <div className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-center text-sm font-semibold text-emerald-400">
                  ✓ Completed {t.verified ? "(verified)" : "(attested)"}
                </div>
              ) : (
                <div className="mt-4 flex gap-2">
                  {t.url && (
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 rounded-lg border border-ember-500/60 bg-ember-500/10 px-3 py-2 text-center text-sm font-bold text-ember-400 shadow-sm transition hover:bg-ember-500 hover:text-navy-950 active:scale-[0.99]"
                    >
                      Open official page ↗
                    </a>
                  )}
                  <button
                    disabled={busy === t.id}
                    onClick={() => complete(t.id, t.id === "JOIN_DISCORD")}
                    className="flex-1 rounded-lg bg-ember-500 px-3 py-2 text-sm font-bold text-navy-950 disabled:opacity-50 hover:bg-ember-400"
                  >
                    {busy === t.id
                      ? "Verifying…"
                      : t.id === "JOIN_DISCORD"
                        ? "I joined ✓"
                        : "Verify follow"}
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Linked accounts */}
      <LinkedAccounts />

      {/* Hashtag posts */}
      {hashtagTask && (
        <section className="rounded-2xl border border-navy-700 bg-navy-900 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">{hashtagTask.title}</h2>
            <span className="font-mono text-sm font-bold text-ember-400">
              +{hashtagTask.points.toLocaleString()} pts per post · unlimited
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {hashtagTask.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CAMPAIGN_HASHTAGS.map((tag) => (
              <a
                key={tag}
                href={`https://x.com/hashtag/${tag.slice(1)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-navy-700 px-3 py-1 text-sm font-semibold text-ember-400 hover:border-ember-500"
              >
                {tag}
              </a>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={tweetUrl}
              onChange={(e) => setTweetUrl(e.target.value)}
              placeholder="Paste your X post URL, e.g. https://x.com/you/status/123…"
              className="flex-1 rounded-lg border border-navy-700 bg-navy-950 px-3 py-2 text-sm placeholder:text-slate-600 focus:border-ember-500 focus:outline-none"
            />
            <button
              disabled={verifyingHashtag || !tweetUrl.trim()}
              onClick={verifyHashtag}
              className="rounded-lg bg-ember-500 px-5 py-2 text-sm font-bold text-navy-950 disabled:opacity-50 hover:bg-ember-400"
            >
              {verifyingHashtag ? "Verifying…" : "Verify post"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            The post must be from your connected X account and include a
            campaign hashtag.
          </p>
        </section>
      )}

      {/* Engagement milestones */}
      <section className="rounded-2xl border border-navy-700 bg-navy-900 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">Engagement milestones</h2>
          <span className="rounded-full bg-navy-950 px-2.5 py-1 text-xs font-semibold text-slate-300">
            {user?.xVerified
              ? "Your X account: Verified ✓"
              : "Your X account: Unverified"}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Milestones below are evaluated for your account tier (verified or
          unverified — refreshed each time you log in). Paste a post URL to
          check which milestones it has hit.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {ENGAGEMENT_MILESTONES.filter(
            (m) => m.verifiedTier === !!user?.xVerified
          ).map((m) => {
            const def = taskById(m.taskId)!;
            return (
              <li
                key={m.taskId}
                className="flex items-center justify-between gap-3 rounded-lg bg-navy-950 px-3 py-2"
              >
                <span className="text-slate-300">{describeMilestone(m)}</span>
                <span className="shrink-0 font-mono text-xs font-bold text-ember-400">
                  +{def.points.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={engUrl}
            onChange={(e) => setEngUrl(e.target.value)}
            placeholder="Paste your X post URL, e.g. https://x.com/you/status/123…"
            className="flex-1 rounded-lg border border-navy-700 bg-navy-950 px-3 py-2 text-sm placeholder:text-slate-600 focus:border-ember-500 focus:outline-none"
          />
          <button
            disabled={checkingEng || !engUrl.trim()}
            onClick={checkEngagement}
            className="rounded-lg bg-ember-500 px-5 py-2 text-sm font-bold text-navy-950 disabled:opacity-50 hover:bg-ember-400"
          >
            {checkingEng ? "Checking…" : "Check my tweet"}
          </button>
        </div>
        {engResult?.kind === "pending" && (
          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            {engResult.message}
          </div>
        )}
        {engResult?.kind === "result" && (
          <div className="mt-3 space-y-2 text-sm">
            {engResult.data.awarded.length > 0 && (
              <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-300">
                +{engResult.data.totalPoints.toLocaleString()} pts earned:{" "}
                {engResult.data.awarded
                  .map((a) => `${a.name} (+${a.points})`)
                  .join(" · ")}
              </div>
            )}
            {engResult.data.awarded.length === 0 &&
              engResult.data.alreadyClaimed.length === 0 && (
                <div className="rounded-lg bg-navy-950 px-3 py-2 text-slate-400">
                  No milestones met yet — keep pushing this post.
                </div>
              )}
            {engResult.data.alreadyClaimed.length > 0 && (
              <div className="rounded-lg bg-navy-950 px-3 py-2 text-slate-500">
                Already claimed for this post:{" "}
                {engResult.data.alreadyClaimed.length} milestone
                {engResult.data.alreadyClaimed.length === 1 ? "" : "s"}.
              </div>
            )}
            <div className="font-mono text-xs text-slate-500">
              Post stats: {engResult.data.metrics.retweet_count.toLocaleString()}{" "}
              retweets · {engResult.data.metrics.quote_count.toLocaleString()}{" "}
              quotes · {engResult.data.metrics.like_count.toLocaleString()} likes
              · {engResult.data.metrics.reply_count.toLocaleString()} replies
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Requires X API access (Basic tier or higher) — engagement metrics
          can't be self-attested. Only your own posts count; each milestone is
          claimable once per post, unlimited posts per day.
        </p>
      </section>

      {/* Location pins */}
      <section className="rounded-2xl border border-navy-700 bg-navy-900 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">Live area location pinpoints</h2>
          <span className="font-mono text-sm font-bold text-ember-400">
            +1,500 pts per pin · {pins.length} shared
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Drop a pin on your real, live area. Earn for every pin — up to 10 per
          day — as long as each new pin is at least 100 m from your previous
          ones.
        </p>
        <div className="mt-4">
          {MAPS_KEY ? (
            <GoogleMapsPicker onSubmit={submitPin} submitting={submittingPin} />
          ) : (
            <>
              {!hideFreeMapNote && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-navy-700 bg-navy-950 px-3 py-2 text-xs text-slate-400">
                  <span>
                    🗺️ Free map mode — add a{" "}
                    <code className="rounded bg-navy-900 px-1">
                      VITE_GOOGLE_MAPS_API_KEY
                    </code>{" "}
                    for Google Maps.
                  </span>
                  <button
                    type="button"
                    onClick={() => setHideFreeMapNote(true)}
                    aria-label="Dismiss"
                    className="shrink-0 rounded px-1.5 py-0.5 text-slate-500 hover:bg-navy-800 hover:text-slate-200"
                  >
                    ✕
                  </button>
                </div>
              )}
              <OsmMapPicker onSubmit={submitPin} submitting={submittingPin} />
            </>
          )}
        </div>
        {pins.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-300">
              Your recent pins
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-400">
              {pins.slice(0, 5).map((p) => (
                <li key={p.id} className="font-mono text-xs">
                  {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                  {p.city ? ` · ${p.city}` : ""} ·{" "}
                  {new Date(p.created_at).toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
