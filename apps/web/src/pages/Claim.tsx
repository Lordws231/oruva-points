import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "../lib/wallet";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { ClaimableSeason } from "../lib/types";

const STATUS_STYLE: Record<ClaimableSeason["status"], string> = {
  upcoming: "border-slate-600 bg-slate-500/10 text-slate-300",
  active: "border-amber-600 bg-amber-500/10 text-amber-300",
  "claim-open": "border-emerald-700 bg-emerald-500/10 text-emerald-300",
  closed: "border-navy-700 bg-navy-800 text-slate-500",
};

const STATUS_LABEL: Record<ClaimableSeason["status"], string> = {
  upcoming: "Upcoming",
  active: "Live now",
  "claim-open": "Claim open",
  closed: "Closed",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Claim() {
  const { user, connectX } = useAuth();
  const { publicKey, connected } = useWallet();
  const [seasons, setSeasons] = useState<ClaimableSeason[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      api
        .claimSeasons()
        .then((r) => setSeasons(r.seasons))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  async function doClaim(season: number) {
    if (!publicKey) return;
    setBusy(season);
    setError(null);
    setResult(null);
    try {
      const r = await api.claim(season, publicKey.toBase58());
      setResult(
        `Claimed ${r.tokens.toLocaleString()} ORVA for Season ${r.season} — ${r.explorerUrl}`
      );
      const refreshed = await api.claimSeasons();
      setSeasons(refreshed.seasons);
    } catch (e) {
      setError(
        e instanceof ApiError ? `Claim failed: ${e.message}` : "Claim failed."
      );
    } finally {
      setBusy(null);
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-navy-700 bg-navy-900 p-10 text-center">
        <h1 className="text-2xl font-bold">Connect to claim</h1>
        <p className="mt-2 text-slate-400">
          Sign in with X to see your claimable ORVA.
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Claim ORVA</h1>
        <p className="mt-1 text-slate-400">
          Points accrue weekly across three 26-week seasons (6 months each).
          At each season's end you can claim your pro-rata share of{" "}
          <strong className="text-ember-400">100,000,000 ORVA</strong> during
          the 14-day claim window.
        </p>
      </div>

      {!connected && (
        <div className="rounded-2xl border border-navy-700 bg-navy-900 p-6 text-center">
          <p className="text-sm text-slate-300">
            Connect your Solana wallet to receive ORVA:
          </p>
          <div className="mt-3 flex justify-center">
            <WalletMultiButton />
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-700 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          ✓ {result}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-4">
          {seasons.map((s) => (
            <div
              key={s.season}
              className="rounded-2xl border border-navy-700 bg-navy-900 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">
                      Season {s.season} · {s.name}
                    </h3>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[s.status]}`}
                    >
                      {STATUS_LABEL[s.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    <span className="font-semibold text-slate-300">
                      {s.theme}
                    </span>{" "}
                    — {s.description}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Weeks {s.weekIds[0]} → {s.weekIds[s.weekIds.length - 1]}
                    {" · "}claim window ends {fmtDate(s.claimWindowEndsAt)}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    Your season points:{" "}
                    <span className="font-mono font-bold text-white">
                      {s.points.toLocaleString()}
                    </span>{" "}
                    / {s.totalPoints.toLocaleString()} total (
                    {(s.share * 100).toFixed(2)}%)
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-2xl font-extrabold text-ember-400">
                    {s.tokens.toLocaleString()} ORVA
                  </p>
                  <p className="text-xs text-slate-500">
                    of {s.orvaPerSeason.toLocaleString()} pool
                  </p>
                </div>
              </div>
              {s.alreadyClaimed ? (
                <p className="mt-4 text-sm font-semibold text-emerald-300">
                  ✓ Already claimed
                  {s.claimTxSig && (
                    <>
                      {" — "}
                      <a
                        href={`https://solscan.io/tx/${s.claimTxSig}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        view transaction
                      </a>
                    </>
                  )}
                </p>
              ) : (
                <button
                  disabled={
                    !connected || busy === s.season || !s.claimWindowOpen
                  }
                  onClick={() => doClaim(s.season)}
                  className="mt-4 rounded-lg bg-ember-500 px-6 py-2.5 font-bold text-navy-950 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-ember-400"
                >
                  {busy === s.season
                    ? "Claiming…"
                    : s.status === "closed"
                      ? "Window closed"
                      : s.status !== "claim-open"
                        ? `Opens ${fmtDate(s.endsAt)}`
                        : s.points <= 0
                          ? "No points this season"
                          : "Claim to wallet"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500">
        One claim per season, recorded on-chain. Unclaimed allocation after
        the 14-day window returns to the treasury. Transaction fees are paid
        by the distributor — you only need a Solana wallet address.
      </p>
    </div>
  );
}
