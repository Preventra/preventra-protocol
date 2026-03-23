/**
 * Register Clawburt as Agent #1 on Preventra Protocol (devnet).
 *
 * Usage:
 *   npx ts-node scripts/register-clawburt.ts
 *
 * Prerequisites:
 *   - Solana CLI configured for devnet: solana config set --url devnet
 *   - Funded devnet wallet (at least 0.1 SOL)
 *   - Program deployed to devnet
 *
 * This script is idempotent-safe: if Clawburt already exists, it prints the
 * existing vault details instead of failing silently.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

// Preventra program ID (devnet)
const PROGRAM_ID = new PublicKey(
  "D8M6B7B7KZo3A1VJH5Qk5e21Yiu3QtQuwuN8N6ZhhxuL"
);

// Clawburt registration parameters
const CLAWBURT_CONFIG = {
  name: "Clawburt",
  model: "claude-opus-4-6",
  capabilities: ["strategy", "operations", "content"],
  bio: "Chief of Staff AI. Strategy, operations, and chaos management.",
  dailySpendLimit: new anchor.BN(100_000_000_000),     // 100 SOL
  reserveFloor: new anchor.BN(500_000_000_000),        // 500 SOL
  multisigThreshold: new anchor.BN(1_000_000_000_000), // 1000 SOL
};

// SHA-256 placeholder hash for Clawburt's initial build
// In production, this would be the actual hash of the agent's build artifacts
function getClawburtBuildHash(): number[] {
  const hash = new Uint8Array(32);
  // Deterministic fill so the hash is reproducible
  for (let i = 0; i < 32; i++) {
    hash[i] = (0xcb + i) % 256;
  }
  return Array.from(hash);
}

async function main() {
  console.log("=== Preventra Protocol: Register Clawburt ===\n");

  // Set up provider from environment (reads Anchor.toml + Solana CLI config)
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  console.log("Cluster:  ", provider.connection.rpcEndpoint);
  console.log("Wallet:   ", provider.wallet.publicKey.toBase58());

  // Check wallet balance
  const balance = await provider.connection.getBalance(
    provider.wallet.publicKey
  );
  console.log("Balance:  ", (balance / LAMPORTS_PER_SOL).toFixed(4), "SOL\n");

  if (balance < 0.05 * LAMPORTS_PER_SOL) {
    console.error("ERROR: Wallet balance too low. Need at least 0.05 SOL.");
    console.error("Run: solana airdrop 2");
    process.exit(1);
  }

  // Load IDL from build artifacts
  const idlPath = path.resolve(__dirname, "../target/idl/preventra.json");
  if (!fs.existsSync(idlPath)) {
    console.error("ERROR: IDL not found at", idlPath);
    console.error("Run: anchor build");
    process.exit(1);
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider);

  // Generate Clawburt's identity keypair
  // Save it so we can reference the identity later
  const keypairPath = path.resolve(__dirname, "../.clawburt-identity.json");
  let clawburtIdentity: Keypair;

  if (fs.existsSync(keypairPath)) {
    console.log("Found existing Clawburt identity keypair.");
    const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    clawburtIdentity = Keypair.fromSecretKey(new Uint8Array(secretKey));
  } else {
    clawburtIdentity = Keypair.generate();
    fs.writeFileSync(
      keypairPath,
      JSON.stringify(Array.from(clawburtIdentity.secretKey))
    );
    console.log("Generated new Clawburt identity keypair.");
    console.log("Saved to:", keypairPath);
  }

  console.log("Identity: ", clawburtIdentity.publicKey.toBase58());

  // Derive PDAs
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), clawburtIdentity.publicKey.toBuffer()],
    PROGRAM_ID
  );
  const [provenancePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("provenance"), clawburtIdentity.publicKey.toBuffer()],
    PROGRAM_ID
  );

  console.log("Vault PDA:", vaultPda.toBase58());
  console.log("Prov. PDA:", provenancePda.toBase58());
  console.log("");

  // Check if already registered
  const existingVault = await provider.connection.getAccountInfo(vaultPda);
  if (existingVault) {
    console.log("Clawburt is already registered on this cluster!");
    console.log("");

    // Fetch and display vault details
    const accounts = program.account as Record<
      string,
      { fetch: Function }
    >;
    const vault = await accounts["vaultAccount"].fetch(vaultPda);
    const provenance = await accounts["provenanceRecord"].fetch(provenancePda);

    printVaultDetails(vault, provenance, clawburtIdentity.publicKey, vaultPda, provenancePda);
    return;
  }

  // Register Clawburt
  console.log("Registering Clawburt...");

  try {
    const tx = await program.methods
      .register(
        CLAWBURT_CONFIG.name,
        CLAWBURT_CONFIG.model,
        getClawburtBuildHash(),
        CLAWBURT_CONFIG.capabilities,
        CLAWBURT_CONFIG.bio,
        CLAWBURT_CONFIG.dailySpendLimit,
        CLAWBURT_CONFIG.reserveFloor,
        CLAWBURT_CONFIG.multisigThreshold
      )
      .accounts({
        vault: vaultPda,
        provenance: provenancePda,
        agentIdentity: clawburtIdentity.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([clawburtIdentity])
      .rpc();

    console.log("\nClawburt registered successfully!");
    console.log("Transaction:", tx);
    console.log(
      "Explorer:  ",
      `https://explorer.solana.com/tx/${tx}?cluster=devnet`
    );
    console.log("");

    // Fetch and display vault details
    const accounts = program.account as Record<
      string,
      { fetch: Function }
    >;
    const vault = await accounts["vaultAccount"].fetch(vaultPda);
    const provenance = await accounts["provenanceRecord"].fetch(provenancePda);

    printVaultDetails(vault, provenance, clawburtIdentity.publicKey, vaultPda, provenancePda);
  } catch (err) {
    console.error("\nRegistration failed:");
    console.error(err);
    process.exit(1);
  }
}

function printVaultDetails(
  vault: Record<string, unknown>,
  provenance: Record<string, unknown>,
  identity: PublicKey,
  vaultPda: PublicKey,
  provenancePda: PublicKey
) {
  console.log("=== Clawburt - Agent #1 ===");
  console.log("");
  console.log("Identity:           ", identity.toBase58());
  console.log("Owner:              ", String(vault.owner));
  console.log("Vault PDA:          ", vaultPda.toBase58());
  console.log("Provenance PDA:     ", provenancePda.toBase58());
  console.log("");
  console.log("--- Vault Governance ---");
  console.log("Balance:            ", String(vault.balance), "lamports");
  console.log("Daily Spend Limit:  ", String(vault.dailySpendLimit), "lamports");
  console.log("Reserve Floor:      ", String(vault.reserveFloor), "lamports");
  console.log("Multisig Threshold: ", String(vault.multisigThreshold), "lamports");
  console.log("Status:             ", vault.status);
  console.log("");
  console.log("--- Build Provenance ---");
  console.log("Model:              ", provenance.model);
  console.log("Model Changed:      ", provenance.modelChanged);
  console.log("Change Count:       ", String(provenance.changeCount));
  console.log("");
  console.log("Explorer Links:");
  console.log(
    "  Vault:      ",
    `https://explorer.solana.com/address/${vaultPda.toBase58()}?cluster=devnet`
  );
  console.log(
    "  Provenance: ",
    `https://explorer.solana.com/address/${provenancePda.toBase58()}?cluster=devnet`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
