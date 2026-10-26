import { Fragment, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  CAMPAIGN_HASHTAGS,
  ENGAGEMENT_MILESTONES,
  describeMilestone,
  taskById,
} from "@oruva/shared";
import { useAuth } from "../lib/auth";

const STEPS = [
  {
    n: 1,
    title: "Connect with X",
    text: "Sign in with your X (Twitter) account. This links your engagement to your points wallet.",
  },
  {
    n: 2,
    title: "Complete tasks",
    text: "Follow @Oruvatransport on X, Oruva Transportation Services on Facebook, @oruvatransportation on Instagram and Threads, follow the founder on X and LinkedIn, follow Oruva Transportation Services on LinkedIn, join the Oruva Discord server, post on X with the campaign hashtags, hit engagement milestones on your posts, and share live area location pinpoints.",
  },
  {
    n: 3,
    title: "Earn points weekly",
    text: "Points accrue in weekly epochs (Monday 00:00 Africa/Lagos) across three 26-week seasons — Ignition, Refinement, Acceleration. Watch your rank on the leaderboard.",
  },
  {
    n: 4,
    title: "Claim ORVA on Solana",
    text: "At the end of each 6-month season, claim your pro-rata share of 100,000,000 ORVA during the 14-day claim window.",
  },
];

interface PointRow {
  task: string;
  pts: string;
  freq: string;
  /** Official destination — the task name renders as a clickable link. */
  url?: string;
}

const POINT_GROUPS: { heading: string | null; rows: PointRow[] }[] = [
  {
    heading: null,
    rows: [
      { task: "Follow @Oruvatransport on X", pts: "1,000", freq: "one-time", url: "https://x.com/Oruvatransport" },
      { task: "Follow founder @AbiodunOyaniyi on X", pts: "1,000", freq: "one-time", url: "https://x.com/AbiodunOyaniyi" },
      { task: "Follow founder on LinkedIn", pts: "1,000", freq: "one-time", url: "https://www.linkedin.com/in/abiodun-oyaniyi-6aab0a253" },
      { task: "Follow Oruva Transportation Services on LinkedIn", pts: "1,000", freq: "one-time", url: "https://www.linkedin.com/company/oruvatransport/" },
      { task: "Follow @oruvatransportation on Instagram", pts: "1,000", freq: "one-time", url: "https://www.instagram.com/oruvatransportation/" },
      { task: "Follow @oruvatransportation on Threads", pts: "1,000", freq: "one-time", url: "https://www.threads.com/@oruvatransportation" },
      { task: "Follow Oruva Transportation Services on Facebook", pts: "1,000", freq: "one-time", url: "https://www.facebook.com/Ogunstatenysc2016batchBplatoon3" },
      { task: "Join the Oruva Discord server", pts: "1,000", freq: "one-time", url: "https://discord.gg/6G67trYsMw" },
      { task: "Post on X with campaign hashtags", pts: "100", freq: "repeatable · unlimited" },
      { task: "Share live area location pinpoint", pts: "1,500", freq: "repeatable · up to 10/day" },
    ],
  },
  {
    heading: "Engagement milestones",
    rows: [
      { task: "100+ retweets & over 100 likes (verified account)", pts: "250", freq: "per post · verified accounts" },
      { task: "100+ quotes & over 100 likes (verified account)", pts: "300", freq: "per post · verified accounts" },
      { task: "Over 500 likes (verified account)", pts: "200", freq: "per post · verified accounts" },
      { task: "Over 100 replies (verified account)", pts: "200", freq: "per post · verified accounts" },
      { task: "50+ retweets & 50+ likes (unverified account)", pts: "150", freq: "per post · unverified accounts" },
      { task: "50+ quotes (unverified account)", pts: "150", freq: "per post · unverified accounts" },
      { task: "100+ likes (unverified account)", pts: "150", freq: "per post · unverified accounts" },
      { task: "50+ replies (unverified account)", pts: "100", freq: "per post · unverified accounts" },
    ],
  },
];

function Calculator() {
  const [f1, setF1] = useState(true);
  const [f2, setF2] = useState(true);
  const [f3, setF3] = useState(false);
  const [f4, setF4] = useState(false);
  const [f5, setF5] = useState(false);
  const [f6, setF6] = useState(false);
  const [f7, setF7] = useState(false);
  const [f8, setF8] = useState(false);
  const [posts, setPosts] = useState(20);
  const [pins, setPins] = useState(7);
  const [milestones, setMilestones] = useState<Record<string, boolean>>({});

  const milestonePoints = Object.entries(milestones)
    .filter(([, v]) => v)
    .reduce((s, [id]) => s + (taskById(id)?.points ?? 0), 0);

  const points =
    (f1 ? 1000 : 0) +
    (f2 ? 1000 : 0) +
    (f3 ? 1000 : 0) +
    (f4 ? 1000 : 0) +
    (f5 ? 1000 : 0) +
    (f6 ? 1000 : 0) +
    (f7 ? 1000 : 0) +
    (f8 ? 1000 : 0) +
    posts * 100 +
    pins * 1500 +
    milestonePoints;

  return (
    <div className="rounded-2xl border border-navy-700 bg-navy-900 p-6">
      <h3 className="text-lg font-bold">Points calculator</h3>
      <p className="mt-1 text-sm text-slate-400">
        Estimate your points haul. Tokens convert pro-rata from your season's
        100,000,000 ORVA pool at season end.
      </p>
      <div className="mt-4 space-y-3 text-sm">
        {[
          { label: "Follow @Oruvatransport (+1,000)", v: f1, s: setF1, url: "https://x.com/Oruvatransport" },
          { label: "Follow founder on X (+1,000)", v: f2, s: setF2, url: "https://x.com/AbiodunOyaniyi" },
          { label: "Follow founder on LinkedIn (+1,000)", v: f3, s: setF3, url: "https://www.linkedin.com/in/abiodun-oyaniyi-6aab0a253" },
          { label: "Follow Oruva Transportation Services on LinkedIn (+1,000)", v: f8, s: setF8, url: "https://www.linkedin.com/company/oruvatransport/" },
          { label: "Follow @oruvatransportation on Instagram (+1,000)", v: f5, s: setF5, url: "https://www.instagram.com/oruvatransportation/" },
          { label: "Follow @oruvatransportation on Threads (+1,000)", v: f6, s: setF6, url: "https://www.threads.com/@oruvatransportation" },
          { label: "Follow Oruva Transportation Services on Facebook (+1,000)", v: f7, s: setF7, url: "https://www.facebook.com/Ogunstatenysc2016batchBplatoon3" },
          { label: "Join the Oruva Discord server (+1,000)", v: f4, s: setF4, url: "https://discord.gg/6G67trYsMw" },
        ].map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <label className="flex flex-1 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={r.v}
                onChange={(e) => r.s(e.target.checked)}
                className="h-4 w-4 accent-amber-500"
              />
              {r.label}
            </label>
            {"url" in r && r.url && (
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${r.label}`}
                className="shrink-0 rounded-full border border-ember-500/60 bg-ember-500/10 px-3 py-1 text-xs font-bold text-ember-400 transition hover:bg-ember-500 hover:text-navy-950 active:scale-[0.98]"
              >
                Open ↗
              </a>
            )}
          </div>
        ))}
        <div>
          <label className="flex items-center justify-between">
            <span>Hashtag posts (+100 each)</span>
            <span className="font-mono text-ember-400">{posts}</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={posts}
            onChange={(e) => setPosts(Number(e.target.value))}
            className="mt-2 w-full accent-amber-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            No daily limit — every verified post with a campaign hashtag earns.
          </p>
        </div>
        <div>
          <label className="flex items-center justify-between">
            <span>Location pins this week (+1,500 each)</span>
            <span className="font-mono text-ember-400">{pins}</span>
          </label>
          <input
            type="range"
            min={0}
            max={70}
            value={pins}
            onChange={(e) => setPins(Number(e.target.value))}
            className="mt-2 w-full accent-amber-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            Max 10 pins/day · each pin must be ≥100 m from your previous pins.
          </p>
        </div>
        <details className="rounded-xl border border-navy-800 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">
            Engagement milestones{" "}
            <span className="font-normal text-slate-500">
              — tick if the thresholds are met
            </span>
          </summary>
          <div className="mt-2 space-y-2">
            {ENGAGEMENT_MILESTONES.map((m) => {
              const def = taskById(m.taskId)!;
              return (
                <label
                  key={m.taskId}
                  className="flex cursor-pointer items-center gap-3"
                >
                  <input
                    type="checkbox"
                    checked={!!milestones[m.taskId]}
                    onChange={(e) =>
                      setMilestones({
                        ...milestones,
                        [m.taskId]: e.target.checked,
                      })
                    }
                    className="h-4 w-4 shrink-0 accent-amber-500"
                  />
                  <span className="flex-1">
                    {describeMilestone(m)}{" "}
                    <span className="text-slate-500">
                      ({m.verifiedTier ? "verified" : "unverified"} account)
                    </span>
                  </span>
                  <span className="font-mono text-ember-400">+{def.points}</span>
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Requires X API access — metrics can't be self-attested. Each
            milestone is claimable once per post.
          </p>
        </details>
      </div>
      <div className="mt-5 rounded-xl bg-navy-950 p-4 text-center">
        <p className="text-xs uppercase tracking-widest text-slate-500">
          Estimated points
        </p>
        <p className="text-4xl font-extrabold text-ember-400">
          {points.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

/** Inline official-page link used in the "Complete tasks" step. */
function StepLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="mx-0.5 inline-flex items-center gap-1 rounded-full border border-ember-500/50 bg-ember-500/10 px-2.5 py-0.5 align-baseline font-semibold text-ember-400 transition hover:bg-ember-500 hover:text-navy-950 active:scale-[0.98]"
    >
      {children} ↗
    </a>
  );
}

export default function Home() {
  const { user, connectX } = useAuth();

  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="hero-grid relative overflow-hidden rounded-3xl border border-navy-700 bg-navy-900 px-6 py-14 text-center md:py-20">
        <img
          src="/oruva-logo.jpg"
          alt="Oruva Transportation Services"
          className="mx-auto h-28 w-28 rounded-2xl object-cover shadow-2xl ring-2 ring-ember-500/40"
        />
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight md:text-6xl">
          Ride the movement. <span className="text-ember-400">Earn ORVA.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
          Oruva Points rewards the community powering Oruva Transportation
          Services. Follow, share your live area, earn points weekly — and claim
          them as <strong>ORVA</strong> SPL tokens on Solana.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {user ? (
            <Link
              to="/tasks"
              className="rounded-xl bg-ember-500 px-7 py-3 font-bold text-navy-950 hover:bg-ember-400"
            >
              Go to tasks
            </Link>
          ) : (
            <button
              onClick={connectX}
              className="rounded-xl bg-ember-500 px-7 py-3 font-bold text-navy-950 hover:bg-ember-400"
            >
              Connect with X
            </button>
          )}
          <Link
            to="/leaderboard"
            className="rounded-xl border border-navy-700 px-7 py-3 font-semibold text-slate-200 hover:border-ember-500"
          >
            View leaderboard
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="text-2xl font-bold">How it works</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-navy-700 bg-navy-900 p-5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ember-500 font-bold text-navy-950">
                {s.n}
              </div>
              <h3 className="mt-3 font-bold">{s.title}</h3>
              {s.n === 2 ? (
                <p className="mt-1 text-sm text-slate-400">
                  Follow @Oruvatransport on{" "}
                  <StepLink href="https://x.com/Oruvatransport">X</StepLink>{" "}
                  and{" "}
                  <StepLink href="https://www.facebook.com/Ogunstatenysc2016batchBplatoon3">
                    Facebook
                  </StepLink>
                  , and @oruvatransportation on{" "}
                  <StepLink href="https://www.instagram.com/oruvatransportation/">
                    Instagram
                  </StepLink>{" "}
                  and{" "}
                  <StepLink href="https://www.threads.com/@oruvatransportation">
                    Threads
                  </StepLink>
                  , follow the founder on{" "}
                  <StepLink href="https://x.com/AbiodunOyaniyi">X</StepLink>{" "}
                  and{" "}
                  <StepLink href="https://www.linkedin.com/in/abiodun-oyaniyi-6aab0a253">
                    LinkedIn
                  </StepLink>
                  , follow{" "}
                  <StepLink href="https://www.linkedin.com/company/oruvatransport/">
                    Oruva Transportation Services on LinkedIn
                  </StepLink>
                  , join the{" "}
                  <StepLink href="https://discord.gg/6G67trYsMw">
                    Oruva Discord server
                  </StepLink>
                  , post on X with the campaign hashtags, hit engagement
                  milestones on your posts, and share live area location
                  pinpoints. Always use these official links — then verify
                  each follow on the tasks page to earn.
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-400">{s.text}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Campaign hashtags */}
      <section className="rounded-2xl border border-navy-700 bg-navy-900 p-6">
        <h2 className="text-2xl font-bold">Campaign hashtags</h2>
        <p className="mt-2 text-sm text-slate-400">
          Post on X with any of these hashtags and verify the post on the{" "}
          <Link to="/tasks" className="text-ember-400 underline">
            tasks page
          </Link>{" "}
          to earn <strong className="text-ember-400">100 pts</strong> per
          post — no daily limit, each post claimable once.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {CAMPAIGN_HASHTAGS.map((tag) => (
            <a
              key={tag}
              href={`https://x.com/hashtag/${tag.slice(1)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-navy-700 px-4 py-2 font-mono text-sm font-bold text-ember-400 hover:border-ember-500"
            >
              {tag}
            </a>
          ))}
        </div>
      </section>

      {/* Season 1 banner */}
      <section className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-6 py-4 text-center">
        <p className="text-base font-semibold text-amber-200 md:text-lg">
          🚀 Season 1 starts Monday 26 October 2026 — complete each task for
          1,000 points and get ranked from day one.
        </p>
      </section>

      {/* Points table + calculator */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold">Ways to earn</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-navy-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-800 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {POINT_GROUPS.map((g) => (
                  <Fragment key={g.heading ?? "main"}>
                    {g.heading && (
                      <tr className="border-t border-navy-800 bg-navy-800/60">
                        <td
                          colSpan={2}
                          className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-ember-400"
                        >
                          {g.heading}
                        </td>
                      </tr>
                    )}
                    {g.rows.map((r) => (
                      <tr key={r.task} className="border-t border-navy-800">
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {r.url ? (
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full border border-ember-500/60 bg-ember-500/10 px-3.5 py-1.5 font-semibold text-ember-400 shadow-sm transition hover:bg-ember-500 hover:text-navy-950 active:scale-[0.98]"
                              >
                                {r.task} ↗
                              </a>
                            ) : (
                              r.task
                            )}
                          </div>
                          <div className="text-xs text-slate-500">{r.freq}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-ember-400">
                          {r.pts}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Calculator />
      </section>

      {/* Season explainer */}
      <section className="rounded-2xl border border-navy-700 bg-navy-900 p-6">
        <h2 className="text-2xl font-bold">Seasons, points & Solana claims</h2>
        <div className="mt-3 space-y-2 text-sm text-slate-300">
          <p>
            ⏱️ <strong>18-month program, 3 seasons:</strong> points accrue in
            weekly epochs (Monday 00:00 → Monday 00:00{" "}
            <strong>Africa/Lagos</strong>), grouped into three 26-week seasons
            — <strong>Ignition</strong> (user testing),{" "}
            <strong>Refinement</strong> (feedback),{" "}
            <strong>Acceleration</strong> (growth). Your season score is the
            sum of your points across the season's weeks.
          </p>
          <p>
            🪙 <strong>Claims:</strong> at each season's end you can claim
            your share of <strong>100,000,000 ORVA</strong>:{" "}
            <code className="rounded bg-navy-950 px-1">
              your tokens = floor(your season points ÷ total season points ×
              100,000,000)
            </code>
            . Claims pay out as SPL tokens to your connected Solana wallet,
            one claim per season.
          </p>
          <p>
            ♻️ <strong>Unclaimed tokens</strong> after the 14-day claim window
            return to the treasury.
          </p>
          <p className="text-slate-500">
            Points are experimental engagement rewards and have no monetary
            value on their own — see <Link to="/legal" className="underline">Terms</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
