const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. The program",
    body: (
      <p>
        Oruva Points is an experimental community-engagement program operated
        by <strong>Oruva Transportation Services</strong> (“Oruva”, “we”).
        Participants earn points for community actions such as following our
        accounts, sharing location pins, and posting with campaign hashtags.
        The program runs in three 26-week seasons of weekly epochs (Monday
        00:00 to Monday 00:00, Africa/Lagos), starting 12 October 2026.
      </p>
    ),
  },
  {
    title: "2. Eligibility",
    body: (
      <p>
        Participation requires an X (Twitter) account used to sign in via X
        OAuth, and a Solana wallet (e.g. Phantom or Solflare) if you wish to
        claim token rewards. You must provide accurate information and use the
        program only for lawful purposes.
      </p>
    ),
  },
  {
    title: "3. Points have no monetary value",
    body: (
      <p>
        Points are a record of participation only. They are{" "}
        <strong>not</strong> a currency, security, investment, or promise of
        future value, and they cannot be sold, transferred, or redeemed for
        cash. Point balances and earning rules may be adjusted at any time.
      </p>
    ),
  },
  {
    title: "4. ORVA token rewards",
    body: (
      <p>
        ORVA is the official SPL token of the Oruva community on the Solana
        blockchain, distributed as a community reward — 100,000,000 ORVA per
        season, shared pro-rata among participants based on season points.
        Rewards are paid to the Solana wallet you connect at claim time.
        Nothing on this site is financial advice.
      </p>
    ),
  },
  {
    title: "5. Seasons and claims",
    body: (
      <p>
        Season points are claimable once per user per season, during the
        14-day claim window after that season ends. Claims require a valid
        Solana wallet and enough network fees are covered by the program's
        distributor; users never pay claim fees. Allocations unclaimed after
        the window closes return to the Oruva treasury.
      </p>
    ),
  },
  {
    title: "6. Fair play",
    body: (
      <p>
        Location pins must reflect your real, live area. Pins closer than
        100&nbsp;m to your previous pin, or more than 10 pins per day, earn
        nothing. Self-attested follows may be re-verified once our X API
        access supports it. Bots, sybil accounts, fake locations, or any abuse
        of the program will have points voided and accounts removed, at our
        sole discretion.
      </p>
    ),
  },
  {
    title: "7. Verification limits",
    body: (
      <p>
        Some verifications depend on third-party APIs (X/Twitter). Follow
        tasks are currently self-attested and engagement milestones are
        pending until our X API tier supports metric lookups. We will enable
        automatic verification when available; until then, attested actions
        are taken in good faith and may be audited.
      </p>
    ),
  },
  {
    title: "8. Changes and termination",
    body: (
      <p>
        We may modify, pause, or end the program — including point rules,
        season schedules, and reward mechanics — at any time. We will announce
        material changes on our X account (@Oruvatransport) where reasonable.
      </p>
    ),
  },
  {
    title: "9. Limitation of liability",
    body: (
      <p>
        The program and site are provided “as is” without warranties of any
        kind. To the maximum extent permitted by law, Oruva Transportation
        Services is not liable for any loss arising from participation,
        including lost points, failed claims, or third-party service outages
        (X, Solana, map providers).
      </p>
    ),
  },
  {
    title: "10. Contact",
    body: (
      <p>
        Questions about these terms:{" "}
        <a
          className="text-gold-400 hover:underline"
          href="mailto:abiodunoyaniyi@gmail.com"
        >
          abiodunoyaniyi@gmail.com
        </a>{" "}
        or via X at{" "}
        <a
          className="text-gold-400 hover:underline"
          href="https://x.com/Oruvatransport"
          target="_blank"
          rel="noreferrer"
        >
          @Oruvatransport
        </a>
        .
      </p>
    ),
  },
];

export default function Terms() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Terms of Service</h1>
        <p className="mt-1 text-sm text-slate-400">
          Oruva Points · Last updated 11 October 2026
        </p>
      </div>
      {sections.map((s) => (
        <section
          key={s.title}
          className="rounded-2xl border border-navy-700 bg-navy-900 p-6 text-sm text-slate-300"
        >
          <h2 className="text-lg font-bold text-white">{s.title}</h2>
          <div className="mt-2 space-y-2">{s.body}</div>
        </section>
      ))}
    </div>
  );
}
