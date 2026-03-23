import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

/// Arguments for the register instruction.
export interface RegisterArgs {
  name: string;
  model: string;
  buildHash: number[];
  capabilities: string[];
  bio: string;
  dailySpendLimit: BN;
  reserveFloor: BN;
  multisigThreshold: BN;
}

/// On-chain VaultAccount as returned by Anchor deserialization.
export interface VaultAccount {
  bump: number;
  agentIdentity: PublicKey;
  owner: PublicKey;
  balance: BN;
  totalDeposited: BN;
  totalWithdrawn: BN;
  dailySpendLimit: BN;
  dailySpent: BN;
  lastSpendReset: BN;
  reserveFloor: BN;
  multisigThreshold: BN;
  status: { active: Record<string, never> } | { paused: Record<string, never> };
  createdAt: BN;
  reserved: number[];
}

/// On-chain ProvenanceRecord as returned by Anchor deserialization.
export interface ProvenanceRecord {
  bump: number;
  agentIdentity: PublicKey;
  owner: PublicKey;
  model: string;
  buildHash: number[];
  initialBuildHash: number[];
  modelChanged: boolean;
  changeCount: BN;
  lastVerified: BN;
  createdAt: BN;
  reserved: number[];
}

/// Returns true if the vault status is Active.
export function isVaultActive(vault: VaultAccount): boolean {
  return "active" in vault.status;
}

/// Returns true if the vault status is Paused.
export function isVaultPaused(vault: VaultAccount): boolean {
  return "paused" in vault.status;
}
