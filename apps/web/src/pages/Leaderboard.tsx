import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SEASONS, seasonStatus } from "@oruva/shared";
import { api } from "../lib/api";
import type { LeaderboardEntry } from "../lib/types";

type Mode = "week" | "season";

/** Latest season that has started (or 1 if the program hasn't begun). */
function defaultSeason(): number {
  const now = new Date();
  let d = 1;
  for (const s of SEASONS) {
    if (seasonStatus(s.id, now) !== "upcoming") d = s.id;
  }
  return d;
}

export default function Leaderboard() {
  const [mode, setMode] = useState<Mode>("week");
  const [season, setSeason] = useState<number>(defaultSeason);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [label, setLabel] = useState("");
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p =
      mode === "season" ? api.leaderboard({ season }) : api.leaderboard();
    p.then((r) => {
      setEntries(r.entries);
      setLabel(
        r.season !== undefined
          ? `Season ${r.season} · ${SEASONS[r.season - 1]?.name ?? ""}`
          : `week of ${r.epoch}`
      );
      setMyRank(r.myRank);
    }).finally(() => setLoading(false));
  }, [mode, season]);

  const seasonDef = SEASONS[season - 1];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Leaderboard</h1>
        <p className="mt-1 text-slate-400">
          Top earners{label ? ` (${label})` : ""}.
          {myRank ? ` You are ranked #${myRank}.` : ""}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-xl border border-navy-700">
            {(["week", "season"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-2 text-sm font-bold ${
                  mode === m
                    ? "bg-ember-500 text-navy-950"
                    : "bg-navy-900 text-slate-300 hover:bg-navy-800"
                }`}
              >
                {m === "week" ? "This week" : "Season"}
              </button>
            ))}
          </div>
          {mode === "season" && (
            <div className="flex overflow-hidden rounded-xl border border-navy-700">
              {SEASONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSeason(s.id)}
                  title={`${s.name} — ${s.theme}`}
                  className={`px-4 py-2 text-sm font-bold ${
                    season === s.id
                      ? "bg-ember-500 text-navy-950"
                      : "bg-navy-900 text-slate-300 hover:bg-navy-800"
                  }`}
                >
                  S{s.id}
                </button>
              ))}
            </div>
          )}
        </div>
        {mode === "season" && seasonDef && (
          <p className="mt-2 text-sm text-slate-500">
            <span className="font-semibold text-slate-300">
              Season {seasonDef.id} · {seasonDef.name}
            </span>{" "}
            ({seasonDef.theme}) — {seasonDef.description} Points shown are
            summed across the season's 26 weeks.
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-navy-700 bg-navy-900 p-8 text-center text-slate-400">
          No points earned yet{mode === "season" ? " this season" : " this week"}.{" "}
          <Link to="/tasks" className="text-ember-400 underline">
            Be the first
          </Link>
          .
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-navy-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-800 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 w-16">#</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.username}
                  className={`border-t border-navy-800 ${
                    e.me ? "bg-ember-500/10" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-slate-400">
                    {e.rank}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      {e.avatar && (
                        <img
                          src={e.avatar}
                          alt=""
                          className="h-6 w-6 rounded-full"
                        />
                      )}
                      <span className={e.me ? "font-bold text-ember-400" : ""}>
                        @{e.username}
                        {e.me ? " (you)" : ""}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold">
                    {e.points.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
