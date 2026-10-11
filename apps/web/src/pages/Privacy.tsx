const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. Data we collect",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>X profile data</strong> — when you sign in with X (OAuth), we
          receive your X user ID, username, display name, and avatar.
        </li>
        <li>
          <strong>Location pins</strong> — latitude and longitude you
          voluntarily share via the pin task, plus timestamps.
        </li>
        <li>
          <strong>Wallet address</strong> — the Solana address you provide when
          claiming ORVA rewards.
        </li>
        <li>
          <strong>Activity records</strong> — points earned, tasks completed,
          and claim history.
        </li>
        <li>
          <strong>Session cookie</strong> — a single httpOnly cookie that keeps
          you signed in. No advertising or tracking cookies are used.
        </li>
      </ul>
    ),
  },
  {
    title: "2. What we do NOT collect",
    body: (
      <p>
        We never see or store your X password (sign-in is handled entirely by
        X via OAuth), your wallet private keys or seed phrases, or any payment
        card or bank details.
      </p>
    ),
  },
  {
    title: "3. How we use your data",
    body: (
      <p>
        Your data is used only to operate the program: verifying tasks,
        calculating points, publishing leaderboards, processing ORVA claims,
        preventing abuse, and communicating about the program. We do not sell
        your data or share it with advertisers.
      </p>
    ),
  },
  {
    title: "4. Public by design",
    body: (
      <p>
        Two things about this program are intentionally public: the{" "}
        <strong>leaderboard</strong> displays usernames and point totals, and{" "}
        <strong>Solana claims are recorded on a public blockchain</strong> —
        your wallet address and claimed amounts are visible to anyone, forever.
        Only claim with a wallet you are comfortable associating publicly with
        your X account.
      </p>
    ),
  },
  {
    title: "5. Third-party services",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>X (Twitter)</strong> — authentication and (where supported)
          verification of follows, posts, and engagement. Governed by X's own
          privacy policy.
        </li>
        <li>
          <strong>Solana</strong> — token claims are processed on-chain and are
          publicly visible as described above.
        </li>
        <li>
          <strong>Map providers</strong> — location search and map tiles are
          served by OpenStreetMap contributors (and Google Maps only if you
          use that picker); your typed searches may be sent to the provider.
        </li>
        <li>
          <strong>Hosting</strong> — our API and database are hosted on Railway
          and the site on Vercel, who process data on our behalf.
        </li>
      </ul>
    ),
  },
  {
    title: "6. Data retention and deletion",
    body: (
      <p>
        We keep your data for the life of the program (three 26-week seasons)
        plus a reasonable wind-down period for claims and audits. You may
        request a copy or deletion of your personal data at any time by
        emailing{" "}
        <a
          className="text-gold-400 hover:underline"
          href="mailto:abiodunoyaniyi@gmail.com"
        >
          abiodunoyaniyi@gmail.com
        </a>{" "}
        from the address associated with your account. Note that on-chain
        claim records cannot be deleted — blockchains are immutable.
      </p>
    ),
  },
  {
    title: "7. Security",
    body: (
      <p>
        Sessions are httpOnly cookies transmitted over HTTPS; secrets live
        only in server-side environment variables, never in the site's code.
        No system is perfectly secure, and you are responsible for keeping
        your X account and Solana wallet safe.
      </p>
    ),
  },
  {
    title: "8. Children's privacy",
    body: (
      <p>
        Oruva Points is not directed at children under 13, and we do not
        knowingly collect their data. If you believe a child has participated,
        contact us and we will remove the data.
      </p>
    ),
  },
  {
    title: "9. Changes to this policy",
    body: (
      <p>
        We may update this policy as the program evolves. Material changes
        will be announced on our X account (@Oruvatransport), and the “last
        updated” date above will change.
      </p>
    ),
  },
  {
    title: "10. Contact",
    body: (
      <p>
        Privacy questions or requests:{" "}
        <a
          className="text-gold-400 hover:underline"
          href="mailto:abiodunoyaniyi@gmail.com"
        >
          abiodunoyaniyi@gmail.com
        </a>{" "}
        · Oruva Transportation Services · X{" "}
        <a
          className="text-gold-400 hover:underline"
          href="https://x.com/Oruvatransport"
          target="_blank"
          rel="noreferrer"
        >
          @Oruvatransport
        </a>
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Privacy Policy</h1>
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
