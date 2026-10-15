import {
  ConnectionProvider,
  WalletProvider,
  WalletModalProvider,
} from "./lib/wallet";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./index.css";
import { AuthProvider } from "./lib/auth";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Tasks from "./pages/Tasks";
import Leaderboard from "./pages/Leaderboard";
import CookieConsent from "./components/CookieConsent";
import Claim from "./pages/Claim";
import Legal from "./pages/Legal";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";

const CLUSTER = (import.meta.env.VITE_SOLANA_CLUSTER as string | undefined) ?? "devnet";

function endpointFor(cluster: string): string {
  if (cluster === "mainnet-beta") return clusterApiUrl("mainnet-beta");
  if (cluster === "testnet") return clusterApiUrl("testnet");
  return clusterApiUrl("devnet");
}

export default function App() {
  const endpoint = useMemo(() => endpointFor(CLUSTER), []);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect><CookieConsent />
        <WalletModalProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="tasks" element={<Tasks />} />
                  <Route path="leaderboard" element={<Leaderboard />} />
                  <Route path="claim" element={<Claim />} />
                  <Route path="legal" element={<Legal />} />
                  <Route path="terms" element={<Terms />} />
                  <Route path="privacy" element={<Privacy />} />
                  <Route path="*" element={<Home />} />
                </Route>
              </Routes>
            </BrowserRouter>
            <Analytics />
          </AuthProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
