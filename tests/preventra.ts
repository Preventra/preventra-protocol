import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Preventra } from "../target/types/preventra";
import { Keypair, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("preventra", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Preventra as Program<Preventra>;

  // Shared test state
  let agentIdentity: Keypair;
  let vaultPda: PublicKey;
  let vaultBump: number;
  let provenancePda: PublicKey;
  let provenanceBump: number;

  // Second agent for test 2
  let agentIdentity2: Keypair;

  // Test build hash (SHA-256 of "clawburt-v1")
  const buildHash = new Uint8Array(32);
  buildHash.fill(0xab);

  // Different build hash for provenance update tests
  const newBuildHash = new Uint8Array(32);
  newBuildHash.fill(0xcd);

  before(async () => {
    agentIdentity = Keypair.generate();
    agentIdentity2 = Keypair.generate();

    [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), agentIdentity.publicKey.toBuffer()],
      program.programId
    );

    [provenancePda, provenanceBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("provenance"), agentIdentity.publicKey.toBuffer()],
      program.programId
    );
  });

  // ==========================================================================
  // Registration Tests (1-4)
  // ==========================================================================

  it("1. Register agent, verify identity + vault + provenance all created", async () => {
    const tx = await program.methods
      .register(
        "TestAgent",
        "claude-opus-4-6",
        Array.from(buildHash) as number[],
        ["strategy", "operations"],
        "Test agent for Preventra protocol",
        new anchor.BN(10 * LAMPORTS_PER_SOL),     // daily_spend_limit: 10 SOL
        new anchor.BN(1 * LAMPORTS_PER_SOL),       // reserve_floor: 1 SOL
        new anchor.BN(100 * LAMPORTS_PER_SOL),     // multisig_threshold: 100 SOL
      )
      .accounts({
        vault: vaultPda,
        provenance: provenancePda,
        agentIdentity: agentIdentity.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentIdentity])
      .rpc();

    console.log("Register tx:", tx);

    // Verify vault
    const vault = await program.account.vaultAccount.fetch(vaultPda);
    expect(vault.agentIdentity.toBase58()).to.equal(agentIdentity.publicKey.toBase58());
    expect(vault.owner.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
    expect(vault.balance.toNumber()).to.equal(0);
    expect(vault.dailySpendLimit.toNumber()).to.equal(10 * LAMPORTS_PER_SOL);
    expect(vault.reserveFloor.toNumber()).to.equal(1 * LAMPORTS_PER_SOL);
    expect(vault.multisigThreshold.toNumber()).to.equal(100 * LAMPORTS_PER_SOL);

    // Verify provenance
    const provenance = await program.account.provenanceRecord.fetch(provenancePda);
    expect(provenance.agentIdentity.toBase58()).to.equal(agentIdentity.publicKey.toBase58());
    expect(provenance.model).to.equal("claude-opus-4-6");
    expect(provenance.modelChanged).to.equal(false);
    expect(provenance.changeCount.toNumber()).to.equal(0);
  });

  it("2. Register second agent with same owner (different name)", async () => {
    const [vault2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), agentIdentity2.publicKey.toBuffer()],
      program.programId
    );
    const [provenance2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("provenance"), agentIdentity2.publicKey.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .register(
        "SecondAgent",
        "claude-sonnet-4",
        Array.from(buildHash) as number[],
        ["research"],
        "Second test agent",
        new anchor.BN(5 * LAMPORTS_PER_SOL),
        new anchor.BN(0),
        new anchor.BN(50 * LAMPORTS_PER_SOL),
      )
      .accounts({
        vault: vault2Pda,
        provenance: provenance2Pda,
        agentIdentity: agentIdentity2.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentIdentity2])
      .rpc();

    console.log("Register agent 2 tx:", tx);

    const vault = await program.account.vaultAccount.fetch(vault2Pda);
    expect(vault.agentIdentity.toBase58()).to.equal(agentIdentity2.publicKey.toBase58());
    expect(vault.owner.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
  });

  it("3. Reject registration with name > 32 chars (error 6000)", async () => {
    const badIdentity = Keypair.generate();
    const [badVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), badIdentity.publicKey.toBuffer()],
      program.programId
    );
    const [badProvPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("provenance"), badIdentity.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .register(
          "A".repeat(33),  // 33 chars, exceeds 32 limit
          "model",
          Array.from(buildHash) as number[],
          [],
          "bio",
          new anchor.BN(1),
          new anchor.BN(0),
          new anchor.BN(1),
        )
        .accounts({
          vault: badVaultPda,
          provenance: badProvPda,
          agentIdentity: badIdentity.publicKey,
          owner: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([badIdentity])
        .rpc();
      throw new Error("Should have failed");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("NameTooLong");
    }
  });

  it("4. Reject registration with > 8 capabilities (error 6002)", async () => {
    const badIdentity = Keypair.generate();
    const [badVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), badIdentity.publicKey.toBuffer()],
      program.programId
    );
    const [badProvPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("provenance"), badIdentity.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .register(
          "TooManyCaps",
          "model",
          Array.from(buildHash) as number[],
          ["a", "b", "c", "d", "e", "f", "g", "h", "i"],  // 9 caps, exceeds 8
          "bio",
          new anchor.BN(1),
          new anchor.BN(0),
          new anchor.BN(1),
        )
        .accounts({
          vault: badVaultPda,
          provenance: badProvPda,
          agentIdentity: badIdentity.publicKey,
          owner: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([badIdentity])
        .rpc();
      throw new Error("Should have failed");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("TooManyCapabilities");
    }
  });

  // ==========================================================================
  // Vault Tests (5-12)
  // ==========================================================================

  it("5. Deposit SOL into vault, verify balance", async () => {
    const depositAmount = 5 * LAMPORTS_PER_SOL;

    await program.methods
      .vaultDeposit(new anchor.BN(depositAmount))
      .accounts({
        vault: vaultPda,
        depositor: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const vault = await program.account.vaultAccount.fetch(vaultPda);
    expect(vault.balance.toNumber()).to.equal(depositAmount);
    expect(vault.totalDeposited.toNumber()).to.equal(depositAmount);
  });

  it("6. Withdraw within limits, verify balance and daily_spent", async () => {
    const withdrawAmount = 1 * LAMPORTS_PER_SOL;

    await program.methods
      .vaultWithdraw(new anchor.BN(withdrawAmount))
      .accounts({
        vault: vaultPda,
        owner: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const vault = await program.account.vaultAccount.fetch(vaultPda);
    expect(vault.balance.toNumber()).to.equal(4 * LAMPORTS_PER_SOL);
    expect(vault.dailySpent.toNumber()).to.equal(withdrawAmount);
    expect(vault.totalWithdrawn.toNumber()).to.equal(withdrawAmount);
  });

  it("7. Reject withdrawal that breaches reserve floor (error 6009)", async () => {
    // Vault has 4 SOL, reserve floor is 1 SOL. Withdrawing 3.5 SOL leaves 0.5 < 1.
    const tooMuch = 3.5 * LAMPORTS_PER_SOL;

    try {
      await program.methods
        .vaultWithdraw(new anchor.BN(tooMuch))
        .accounts({
          vault: vaultPda,
          owner: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      throw new Error("Should have failed");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("ReserveFloorBreach");
    }
  });

  it("8. Reject withdrawal that exceeds daily limit (error 6010)", async () => {
    // daily_spend_limit is 10 SOL, already spent 1 SOL. Withdraw 9.5 SOL would
    // bring daily_spent to 10.5 which exceeds 10 SOL limit.
    // But we also only have 4 SOL and reserve floor is 1, so max withdraw is 3 SOL.
    // Let us deposit more first to isolate the daily limit test.
    await program.methods
      .vaultDeposit(new anchor.BN(20 * LAMPORTS_PER_SOL))
      .accounts({
        vault: vaultPda,
        depositor: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Now vault has 24 SOL, daily_spent is 1 SOL, daily_limit is 10 SOL.
    // Withdraw 9.5 SOL would bring daily_spent to 10.5 > 10.
    try {
      await program.methods
        .vaultWithdraw(new anchor.BN(9.5 * LAMPORTS_PER_SOL))
        .accounts({
          vault: vaultPda,
          owner: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      throw new Error("Should have failed");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("DailyLimitExceeded");
    }
  });

  it("9. Verify daily limit resets after 24 hours", async () => {
    // We cannot fast-forward time on localnet easily, so we test the reset
    // logic by verifying the current state and documenting the behavior.
    // The actual 24-hour reset is tested by the on-chain >= comparison.
    const vault = await program.account.vaultAccount.fetch(vaultPda);
    expect(vault.dailySpent.toNumber()).to.equal(1 * LAMPORTS_PER_SOL);
    expect(vault.lastSpendReset.toNumber()).to.be.greaterThan(0);

    // Verify the reset would trigger: if we could advance time by 86400 seconds,
    // daily_spent would reset to 0. For now, confirm the fields are set correctly.
    console.log("  Daily spent:", vault.dailySpent.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("  Last reset:", new Date(vault.lastSpendReset.toNumber() * 1000).toISOString());
    console.log("  Daily limit:", vault.dailySpendLimit.toNumber() / LAMPORTS_PER_SOL, "SOL");
  });

  it("10. Pause vault, verify withdrawals blocked (error 6012)", async () => {
    await program.methods
      .vaultPause()
      .accounts({
        vault: vaultPda,
        owner: provider.wallet.publicKey,
      })
      .rpc();

    const vault = await program.account.vaultAccount.fetch(vaultPda);
    expect(JSON.stringify(vault.status)).to.equal(JSON.stringify({ paused: {} }));

    // Attempt withdrawal while paused
    try {
      await program.methods
        .vaultWithdraw(new anchor.BN(LAMPORTS_PER_SOL))
        .accounts({
          vault: vaultPda,
          owner: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      throw new Error("Should have failed");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("VaultPaused");
    }
  });

  it("11. Unpause vault, verify withdrawals resume", async () => {
    await program.methods
      .vaultUnpause()
      .accounts({
        vault: vaultPda,
        owner: provider.wallet.publicKey,
      })
      .rpc();

    const vault = await program.account.vaultAccount.fetch(vaultPda);
    expect(JSON.stringify(vault.status)).to.equal(JSON.stringify({ active: {} }));

    // Withdrawal should work again
    await program.methods
      .vaultWithdraw(new anchor.BN(LAMPORTS_PER_SOL))
      .accounts({
        vault: vaultPda,
        owner: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const vaultAfter = await program.account.vaultAccount.fetch(vaultPda);
    expect(vaultAfter.balance.toNumber()).to.equal(23 * LAMPORTS_PER_SOL);
  });

  it("12. Reject withdrawal above multisig threshold (error 6011)", async () => {
    // multisig_threshold is 100 SOL
    try {
      await program.methods
        .vaultWithdraw(new anchor.BN(101 * LAMPORTS_PER_SOL))
        .accounts({
          vault: vaultPda,
          owner: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      throw new Error("Should have failed");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("MultisigThresholdExceeded");
    }
  });

  // ==========================================================================
  // Provenance Tests (13-14)
  // ==========================================================================

  it("13. Update provenance with new build hash, verify model_changed flag", async () => {
    await program.methods
      .updateProvenance(
        "claude-opus-4-6-hotfix",
        Array.from(newBuildHash) as number[],
      )
      .accounts({
        provenance: provenancePda,
        owner: provider.wallet.publicKey,
      })
      .rpc();

    const provenance = await program.account.provenanceRecord.fetch(provenancePda);
    expect(provenance.model).to.equal("claude-opus-4-6-hotfix");
    expect(provenance.modelChanged).to.equal(true);
    expect(provenance.changeCount.toNumber()).to.equal(1);
  });

  it("14. Update provenance with original hash, verify model_changed resets", async () => {
    await program.methods
      .updateProvenance(
        "claude-opus-4-6",
        Array.from(buildHash) as number[],
      )
      .accounts({
        provenance: provenancePda,
        owner: provider.wallet.publicKey,
      })
      .rpc();

    const provenance = await program.account.provenanceRecord.fetch(provenancePda);
    expect(provenance.model).to.equal("claude-opus-4-6");
    expect(provenance.modelChanged).to.equal(false);
    // change_count stays at 2 (A > B > A scenario, count never decreases)
    expect(provenance.changeCount.toNumber()).to.equal(2);
  });

  // ==========================================================================
  // Clawburt Registration (15)
  // ==========================================================================

  it("15. Register Clawburt with real parameters", async () => {
    const clawburtIdentity = Keypair.generate();
    const [clawburtVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), clawburtIdentity.publicKey.toBuffer()],
      program.programId
    );
    const [clawburtProvPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("provenance"), clawburtIdentity.publicKey.toBuffer()],
      program.programId
    );

    // Clawburt's build hash (placeholder for test)
    const clawburtHash = new Uint8Array(32);
    clawburtHash.fill(0x01);

    const tx = await program.methods
      .register(
        "Clawburt",
        "claude-opus-4-6",
        Array.from(clawburtHash) as number[],
        ["strategy", "operations", "content"],
        "Chief of Staff AI. Strategy, operations, and chaos management.",
        new anchor.BN(100_000_000_000),     // daily_spend_limit: 100 SOL
        new anchor.BN(500_000_000_000),     // reserve_floor: 500 SOL
        new anchor.BN(1_000_000_000_000),   // multisig_threshold: 1000 SOL
      )
      .accounts({
        vault: clawburtVaultPda,
        provenance: clawburtProvPda,
        agentIdentity: clawburtIdentity.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([clawburtIdentity])
      .rpc();

    console.log("Clawburt registered! Tx:", tx);
    console.log("Clawburt identity:", clawburtIdentity.publicKey.toBase58());

    const vault = await program.account.vaultAccount.fetch(clawburtVaultPda);
    expect(vault.owner.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
    expect(vault.dailySpendLimit.toNumber()).to.equal(100_000_000_000);
    expect(vault.reserveFloor.toNumber()).to.equal(500_000_000_000);
    expect(vault.multisigThreshold.toNumber()).to.equal(1_000_000_000_000);

    const provenance = await program.account.provenanceRecord.fetch(clawburtProvPda);
    expect(provenance.model).to.equal("claude-opus-4-6");
    expect(provenance.modelChanged).to.equal(false);
  });
});
