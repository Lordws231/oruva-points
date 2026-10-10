/**
 * Solana SPL claim layer.
 *
 * The distributor wallet holds the full ORVA supply (see scripts/create-token.ts).
 * claimTokens() transfers `tokensBaseUnits` ORVA from the distributor's
 * associated token account to the user's ATA (creating it if missing) and
 * returns the transaction signature.
 */
import { Keypair, Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import { config } from "./config.js";

let _payer: Keypair | null = null;

export function distributorKeypair(): Keypair {
  if (_payer) return _payer;
  if (!config.distributorSecretKey) {
    throw new Error("DISTRIBUTOR_SECRET_KEY not configured");
  }
  _payer = Keypair.fromSecretKey(bs58.decode(config.distributorSecretKey));
  return _payer;
}

export function orvaMint(): PublicKey {
  if (!config.orvaMint) throw new Error("ORVA_MINT not configured");
  return new PublicKey(config.orvaMint);
}

export function connection(): Connection {
  return new Connection(config.solanaRpcUrl, "confirmed");
}

export interface ClaimResult {
  txSig: string;
  distributor: string;
  userAta: string;
}

/**
 * Transfer ORVA from the distributor to `userWallet`.
 * Idempotency is enforced by the caller (claims table PRIMARY KEY).
 */
export async function claimTokens(
  userWallet: string,
  tokensBaseUnits: bigint
): Promise<ClaimResult> {
  const conn = connection();
  const payer = distributorKeypair();
  const mint = orvaMint();
  const user = new PublicKey(userWallet);

  if (tokensBaseUnits <= 0n) {
    throw new Error("Nothing to claim");
  }

  // Distributor ATA (must exist — funded at token creation).
  const distributorAta = await getOrCreateAssociatedTokenAccount(
    conn,
    payer,
    mint,
    payer.publicKey
  );
  // User ATA (created on demand; payer covers rent).
  const userAta = await getOrCreateAssociatedTokenAccount(
    conn,
    payer,
    mint,
    user
  );

  const balance = await conn.getTokenAccountBalance(distributorAta.address);
  if (BigInt(balance.value.amount) < tokensBaseUnits) {
    throw new Error("Distributor ORVA balance insufficient for this claim");
  }

  const tx = new Transaction().add(
    createTransferInstruction(
      distributorAta.address,
      userAta.address,
      payer.publicKey,
      tokensBaseUnits,
      [],
      TOKEN_PROGRAM_ID
    )
  );
  const sig = await conn.sendTransaction(tx, [payer], {
    skipPreflight: false,
  });
  await conn.confirmTransaction(sig, "confirmed");

  return {
    txSig: sig,
    distributor: payer.publicKey.toBase58(),
    userAta: userAta.address.toBase58(),
  };
}

/** Explorer URL for a signature on the configured cluster. */
export function explorerTxUrl(sig: string): string {
  const clusterParam =
    config.solanaCluster === "mainnet-beta"
      ? ""
      : `?cluster=${config.solanaCluster}`;
  return `https://solscan.io/tx/${sig}${clusterParam}`;
}
