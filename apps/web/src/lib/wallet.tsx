/**
 * The installed @solana/wallet-adapter packages ship .d.ts files whose
 * `react` types resolve to a nested @types/react@19 (via react-native),
 * whose FC allows `Promise<ReactNode>` — not a valid JSX component under
 * our React 18 types. Runtime behavior is unaffected; this shim just
 * re-types the components we render so `tsc` accepts them.
 */
import type { ComponentType, CSSProperties, ReactNode } from "react";
import {
  ConnectionProvider as CP,
  WalletProvider as WP,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider as WMP,
  WalletMultiButton as WMB,
} from "@solana/wallet-adapter-react-ui";
import type { Adapter } from "@solana/wallet-adapter-base";

export const ConnectionProvider =
  CP as unknown as ComponentType<{ endpoint: string; children: ReactNode }>;

export const WalletProvider = WP as unknown as ComponentType<{
  wallets: Adapter[];
  autoConnect?: boolean;
  children: ReactNode;
}>;

export const WalletModalProvider = WMP as unknown as ComponentType<{
  children: ReactNode;
}>;

export const WalletMultiButton = WMB as unknown as ComponentType<{
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}>;
