import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  type ConfirmOptions,
} from "@solana/web3.js";
import type { RegisterArgs, VaultAccount, ProvenanceRecord } from "./types";
import { parseTransactionError } from "./errors";

export { PreventraError, parseTransactionError, getErrorMessage } from "./errors";
export { isVaultActive, isVaultPaused } from "./types";
export type { RegisterArgs, VaultAccount, ProvenanceRecord } from "./types";

/// Preventra devnet program ID.
export const PROGRAM_ID = new PublicKey(
  "D8M6B7B7KZo3A1VJH5Qk5e21Yiu3QtQuwuN8N6ZhhxuL"
);

/// Anchor IDL loaded from build artifacts.
/// eslint-disable-next-line @typescript-eslint/no-var-requires
const IDL = require("../../target/idl/preventra.json");

/// Preventra SDK. Wraps the on-chain program with a clean TypeScript API.
///
/// Usage:
///   const preventra = new Preventra(connection, wallet);
///   const txSig = await preventra.register({...}, identityKeypair);
///   const vault = await preventra.getVault(identityKeypair.publicKey);
export class Preventra {
  public readonly program: Program;
  public readonly provider: AnchorProvider;

  constructor(connection: Connection, wallet: Wallet, opts?: ConfirmOptions) {
    this.provider = new AnchorProvider(connection, wallet, opts ?? {
      commitment: "confirmed",
    });
    this.program = new Program(IDL, this.provider);
  }

  // ---------------------------------------------------------------------------
  // PDA derivation (static, no network calls)
  // ---------------------------------------------------------------------------

  /// Derive the VaultAccount PDA for an agent identity.
  static findVaultPda(agentIdentity: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), agentIdentity.toBuffer()],
      PROGRAM_ID
    );
  }

  /// Derive the ProvenanceRecord PDA for an agent identity.
  static findProvenancePda(agentIdentity: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("provenance"), agentIdentity.toBuffer()],
      PROGRAM_ID
    );
  }

  // ---------------------------------------------------------------------------
  // Instructions
  // ---------------------------------------------------------------------------

  /// Register a new agent with vault governance and build provenance.
  /// The agentIdentityKeypair must sign the transaction to prove control.
  ///
  /// In the two-transaction QuantuLabs flow:
  /// 1. Call QuantuLabs register() with this keypair first
  /// 2. Then call this method with the same keypair
  async register(
    args: RegisterArgs,
    agentIdentityKeypair: Keypair
  ): Promise<string> {
    const [vaultPda] = Preventra.findVaultPda(agentIdentityKeypair.publicKey);
    const [provenancePda] = Preventra.findProvenancePda(
      agentIdentityKeypair.publicKey
    );

    try {
      return await this.program.methods
        .register(
          args.name,
          args.model,
          args.buildHash,
          args.capabilities,
          args.bio,
          args.dailySpendLimit,
          args.reserveFloor,
          args.multisigThreshold
        )
        .accounts({
          vault: vaultPda,
          provenance: provenancePda,
          agentIdentity: agentIdentityKeypair.publicKey,
          owner: this.provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentIdentityKeypair])
        .rpc();
    } catch (err) {
      throw parseTransactionError(err);
    }
  }

  /// Register governance for an existing agent identity.
  /// Recovery method: if the QuantuLabs identity was created but Preventra
  /// registration failed, call this to create just the vault and provenance
  /// without re-creating the identity.
  /// Identical to register() -- the on-chain instruction is the same.
  async registerGovernance(
    args: RegisterArgs,
    agentIdentityKeypair: Keypair
  ): Promise<string> {
    return this.register(args, agentIdentityKeypair);
  }

  /// Deposit SOL into an agent's vault. Anyone can deposit.
  /// Works when vault is Active or Paused.
  async vaultDeposit(agentIdentity: PublicKey, amount: BN): Promise<string> {
    const [vaultPda] = Preventra.findVaultPda(agentIdentity);

    try {
      return await this.program.methods
        .vaultDeposit(amount)
        .accounts({
          vault: vaultPda,
          depositor: this.provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err) {
      throw parseTransactionError(err);
    }
  }

  /// Withdraw SOL from an agent's vault. Owner only.
  /// Enforces daily limit, reserve floor, multisig threshold, and Active status.
  async vaultWithdraw(agentIdentity: PublicKey, amount: BN): Promise<string> {
    const [vaultPda] = Preventra.findVaultPda(agentIdentity);

    try {
      return await this.program.methods
        .vaultWithdraw(amount)
        .accounts({
          vault: vaultPda,
          owner: this.provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err) {
      throw parseTransactionError(err);
    }
  }

  /// Pause an agent's vault. Blocks all withdrawals until unpaused.
  /// Deposits are still accepted while paused. Owner only.
  async vaultPause(agentIdentity: PublicKey): Promise<string> {
    const [vaultPda] = Preventra.findVaultPda(agentIdentity);

    try {
      return await this.program.methods
        .vaultPause()
        .accounts({
          vault: vaultPda,
          owner: this.provider.wallet.publicKey,
        })
        .rpc();
    } catch (err) {
      throw parseTransactionError(err);
    }
  }

  /// Unpause an agent's vault. Resumes normal withdrawal operations.
  /// Owner only. Only valid from Paused state.
  async vaultUnpause(agentIdentity: PublicKey): Promise<string> {
    const [vaultPda] = Preventra.findVaultPda(agentIdentity);

    try {
      return await this.program.methods
        .vaultUnpause()
        .accounts({
          vault: vaultPda,
          owner: this.provider.wallet.publicKey,
        })
        .rpc();
    } catch (err) {
      throw parseTransactionError(err);
    }
  }

  /// Update an agent's build provenance record. Owner only.
  /// Tracks model changes and maintains an immutable change count.
  async updateProvenance(
    agentIdentity: PublicKey,
    newModel: string,
    newBuildHash: number[]
  ): Promise<string> {
    const [provenancePda] = Preventra.findProvenancePda(agentIdentity);

    try {
      return await this.program.methods
        .updateProvenance(newModel, newBuildHash)
        .accounts({
          provenance: provenancePda,
          owner: this.provider.wallet.publicKey,
        })
        .rpc();
    } catch (err) {
      throw parseTransactionError(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Account fetchers
  // ---------------------------------------------------------------------------

  /// Fetch a VaultAccount by agent identity.
  async getVault(agentIdentity: PublicKey): Promise<VaultAccount> {
    const [vaultPda] = Preventra.findVaultPda(agentIdentity);
    // Dynamic IDL loading requires bracket notation for account accessors
    const accounts = this.program.account as Record<string, { fetch: Function; fetchNullable: Function }>;
    return (await accounts["vaultAccount"].fetch(vaultPda)) as VaultAccount;
  }

  /// Fetch a ProvenanceRecord by agent identity.
  async getProvenance(agentIdentity: PublicKey): Promise<ProvenanceRecord> {
    const [provenancePda] = Preventra.findProvenancePda(agentIdentity);
    const accounts = this.program.account as Record<string, { fetch: Function; fetchNullable: Function }>;
    return (await accounts["provenanceRecord"].fetch(provenancePda)) as ProvenanceRecord;
  }

  /// Check if a vault exists for the given agent identity.
  /// Returns null if the account does not exist.
  async getVaultOrNull(agentIdentity: PublicKey): Promise<VaultAccount | null> {
    const [vaultPda] = Preventra.findVaultPda(agentIdentity);
    const accounts = this.program.account as Record<string, { fetch: Function; fetchNullable: Function }>;
    return (await accounts["vaultAccount"].fetchNullable(vaultPda)) as VaultAccount | null;
  }

  /// Check if a provenance record exists for the given agent identity.
  /// Returns null if the account does not exist.
  async getProvenanceOrNull(
    agentIdentity: PublicKey
  ): Promise<ProvenanceRecord | null> {
    const [provenancePda] = Preventra.findProvenancePda(agentIdentity);
    const accounts = this.program.account as Record<string, { fetch: Function; fetchNullable: Function }>;
    return (await accounts["provenanceRecord"].fetchNullable(provenancePda)) as ProvenanceRecord | null;
  }
}
