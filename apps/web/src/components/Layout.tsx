import { Link, NavLink, Outlet } from "react-router-dom";
import { WalletMultiButton } from "../lib/wallet";
import { useAuth } from "../lib/auth";

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-lg px-3 py-2 text-sm font-medium ${
    isActive
      ? "bg-navy-800 text-ember-400"
      : "text-slate-300 hover:bg-navy-800 hover:text-white"
  }`;
}

export default function Layout() {
  const { user, loading, connectX, logout } = useAuth();

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-navy-800 bg-navy-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/oruva-logo.jpg"
              alt="Oruva"
              className="h-10 w-10 rounded-lg object-cover"
            />
            <span className="text-lg font-bold tracking-tight">
              Oruva <span className="text-ember-400">Points</span>
            </span>
          </Link>
          <nav className="ml-4 flex items-center gap-1">
            <NavLink to="/" className={navClass} end>
              Home
            </NavLink>
            <NavLink to="/tasks" className={navClass}>
              Tasks
            </NavLink>
            <NavLink to="/leaderboard" className={navClass}>
              Leaderboard
            </NavLink>
            <NavLink to="/claim" className={navClass}>
              Claim
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <WalletMultiButton />
            {loading ? null : user ? (
              <div className="flex items-center gap-2">
                {user.avatar && (
                  <img
                    src={user.avatar}
                    alt=""
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <span className="text-sm text-slate-300">@{user.username}</span>
                <button
                  onClick={logout}
                  className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-white"
                >
                  Log out
                </button>
              </div>
            ) : (
              <button
                onClick={connectX}
                className="rounded-lg bg-ember-500 px-4 py-2 text-sm font-semibold text-navy-950 hover:bg-ember-400"
              >
                Connect with X
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-navy-800 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 text-sm text-slate-400">
          <span>Oruva Transportation Services · Points → ORVA (Solana)</span>
          <Link to="/legal" className="ml-auto hover:text-white">
            Terms
          </Link>
          <a
            href="https://x.com/Oruvatransport"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            @Oruvatransport
          </a>
        </div>
      </footer>
    </div>
  );
}
