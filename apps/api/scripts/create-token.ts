/**
 * Creates the ORVA SPL token mint and mints the full fixed supply to the
 * distributor wallet.
 *
 * Usage:
 *   1. Set env: SOLANA_RPC_URL, SOLANA_CLUSTER, DISTRIBUTOR_SECRET_KEY
 *      (base58). Or run `solana-keygen new` to make one and fund it with
 *      a little SOL for fees/rent.
 *   2. npm run token:create --workspace apps/api
 *   3. Copy the printed mint address into ORVA_MINT in your .env.
 *
 * Token: name "Oruva Points", symbol ORVA, 9 decimals,
 * fixed supply 1,000,000,000 ORVA minted once to the distributor's ATA.
 */
import { Keypair, Connection, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import bs58 from "bs58";
import { ORVA_DECIMALS, ORVA_TOTAL_SUPPLY } from "@oruva/shared";

async function main(): Promise<void> {
  const rpc = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const secret = process.env.DISTRIBUTOR_SECRET_KEY;
  if (!secret) throw new Error("DISTRIBUTOR_SECRET_KEY is required");
  const payer = Keypair.fromSecretKey(bs58.decode(secret));

  const conn = new Connection(rpc, "confirmed");
  const bal = await conn.getBalance(payer.publicKey);
  console.log(`distributor: ${payer.publicKey.toBase58()} (${bal / 1e9} SOL)`);

  const mintKeypair = Keypair.generate();
  const lamports = await getMinimumBalanceForRentExemptMint(conn);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      ORVA_DECIMALS,
      payer.publicKey, // mint authority
      payer.publicKey, // freeze authority
      TOKEN_PROGRAM_ID
    )
  );
  await sendAndConfirmTransaction(conn, tx, [payer, mintKeypair]);
  const mint = mintKeypair.publicKey;
  console.log(`mint created: ${mint.toBase58()}`);

  const ata = await getOrCreateAssociatedTokenAccount(
    conn,
    payer,
    mint,
    payer.publicKey
  );
  console.log(`distributor ATA: ${ata.address.toBase58()}`);

  const amount = BigInt(ORVA_TOTAL_SUPPLY) * 10n ** BigInt(ORVA_DECIMALS);
  await mintTo(conn, payer, mint, ata.address, payer, amount);
  console.log(
    `minted ${ORVA_TOTAL_SUPPLY.toLocaleString()} ORVA to distributor`
  );

  console.log("\nNext steps:");
  console.log(`  1. Set ORVA_MINT=${mint.toBase58()} in apps/api/.env`);
  console.log(`  2. Keep DISTRIBUTOR_SECRET_KEY safe — it authorizes claims`);
  console.log(
    `  3. View: https://solscan.io/token/${mint.toBase58()}?cluster=${process.env.SOLANA_CLUSTER ?? "devnet"}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
