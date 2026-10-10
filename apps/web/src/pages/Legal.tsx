export default function Legal() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-extrabold">Terms & Disclosures</h1>

      <section className="rounded-2xl border border-navy-700 bg-navy-900 p-6 text-sm text-slate-300">
        <h2 className="text-lg font-bold text-white">1. Experimental program</h2>
        <p className="mt-2">
          Oruva Points is an experimental community-engagement program run by
          Oruva Transportation Services. Points are a record of participation
          and have <strong>no inherent monetary value</strong>. They are not a
          currency, security, investment, or promise of future value.
        </p>
      </section>

      <section className="rounded-2xl border border-navy-700 bg-navy-900 p-6 text-sm text-slate-300">
        <h2 className="text-lg font-bold text-white">2. ORVA tokens</h2>
        <p className="mt-2">
          ORVA is an SPL token on the Solana blockchain distributed as a
          community reward. It was distributed without a presale and exists
          primarily for fun and utility within the Oruva community. Nothing here
          is financial advice.
        </p>
      </section>

      <section className="rounded-2xl border border-navy-700 bg-navy-900 p-6 text-sm text-slate-300">
        <h2 className="text-lg font-bold text-white">3. Fair play</h2>
        <p className="mt-2">
          Location pins must reflect your real, live area. Pins closer than
          100&nbsp;m to your previous pin, or more than 10 pins per day, earn
          nothing. Self-attested follows may be re-verified; abuse, bots, or
          sybil accounts can have points voided.
        </p>
      </section>

      <section className="rounded-2xl border border-navy-700 bg-navy-900 p-6 text-sm text-slate-300">
        <h2 className="text-lg font-bold text-white">4. Seasons & claims</h2>
        <p className="mt-2">
          The program runs in three 26-week seasons of weekly epochs (Monday
          00:00 to Monday 00:00 Africa/Lagos). Points from a season are
          claimable once, during the 14-day claim window after that season
          ends; unclaimed allocations return to the treasury after the window
          closes.
        </p>
      </section>

      <section className="rounded-2xl border border-navy-700 bg-navy-900 p-6 text-sm text-slate-300">
        <h2 className="text-lg font-bold text-white">5. Data</h2>
        <p className="mt-2">
          We store your X user id, username, avatar, shared pinpoints, and an
          optional Solana wallet address to operate the program. Pinpoints you
          share are visible in aggregate on leaderboards/stats.
        </p>
      </section>
    </div>
  );
}
