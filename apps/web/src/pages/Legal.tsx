import { Link } from "react-router-dom";

export default function Legal() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-extrabold">Legal</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/terms"
          className="rounded-2xl border border-navy-700 bg-navy-900 p-6 transition hover:border-gold-500"
        >
          <h2 className="text-lg font-bold text-white">Terms of Service</h2>
          <p className="mt-2 text-sm text-slate-400">
            Program rules, points, ORVA rewards, seasons and claims, fair play.
          </p>
        </Link>
        <Link
          to="/privacy"
          className="rounded-2xl border border-navy-700 bg-navy-900 p-6 transition hover:border-gold-500"
        >
          <h2 className="text-lg font-bold text-white">Privacy Policy</h2>
          <p className="mt-2 text-sm text-slate-400">
            What data we collect, how it is used, and your rights.
          </p>
        </Link>
      </div>
    </div>
  );
}
