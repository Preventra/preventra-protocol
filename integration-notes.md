# QuantuLabs 8004-solana Integration Notes

**Prepared by:** Codeburt (FixCore Development Intelligence)
**Date:** 2026-03-19
**Source repo:** github.com/QuantuLabs/8004-solana
**Purpose:** Document exact CPI signatures, devnet program IDs, quirks, and limitations for Preventra Protocol integration.
**Status:** Research complete. Awaiting Stratburt review before writing Anchor code.

---

## 1. Program IDs (Confirmed Live)

| Program | Devnet | Localnet |
|---------|--------|----------|
| Agent Registry 8004 | `8oo4J9tBB3Hna1jRQ3rWvJjojqM5DYTDJo5cejUuJy3C` | `8oo4dC4JvBLwy5tGgiH3WwK4B9PWxL9Z4XjA2jzkQMbQ` |
| ATOM Engine | `AToMufS4QD6hEXvcvBDg9m1AHeCLpmZQsyfYa5h9MwAF` | same |
| Metaplex Core | `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d` | cloned from devnet |

**Devnet liveness verified:** 2026-03-19 via `solana account`. Program is executable, owned by BPFLoaderUpgradeable. Balance: 0.00114144 SOL.

**IDL version:** agent_registry_8004 v0.5.2, atom_engine v0.2.2

---

## 2. Registration Interface

### 2.1 Instruction Signature

```rust
pub fn register(ctx: Context<Register>, agent_uri: String) -> Result<()>
```

Alternative with ATOM opt-out:
```rust
pub fn register_with_options(
    ctx: Context<Register>,
    agent_uri: String,
    atom_enabled: bool,
) -> Result<()>
```

### 2.2 Required Accounts (Register Context)

| Account | Type | Writable | Signer | PDA Seeds |
|---------|------|----------|--------|-----------|
| `root_config` | RootConfig | no | no | `["root_config"]` |
| `registry_config` | RegistryConfig | no | no | `["registry_config", collection.key()]` |
| `agent_account` | AgentAccount (init) | yes | no | `["agent", asset.key()]` |
| `asset` | UncheckedAccount | yes | **yes** | N/A (fresh Keypair) |
| `collection` | UncheckedAccount | yes | no | Known from RootConfig |
| `owner` | Signer | yes | **yes** | Wallet paying for tx |
| `system_program` | Program | no | no | `11111111111111111111111111111111` |
| `mpl_core_program` | Program | no | no | `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d` |

### 2.3 What Registration Does

1. Validates `agent_uri` length (max 250 bytes)
2. CPIs into Metaplex Core `CreateV2` to mint a new Core asset (NFT)
3. Initializes `AgentAccount` PDA with: collection, creator (= owner at registration), owner, asset, bump, atom_enabled (default true), empty digests/counts, empty agent_uri set to provided value, nft_name set to "Agent"

### 2.4 TypeScript Usage Pattern (from test suite)

```typescript
import { Keypair, SystemProgram, PublicKey } from "@solana/web3.js";

const assetKeypair = Keypair.generate();
const [agentPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("agent"), assetKeypair.publicKey.toBuffer()],
  REGISTRY_PROGRAM_ID
);

const [rootConfigPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("root_config")],
  REGISTRY_PROGRAM_ID
);

// collection pubkey must be fetched from rootConfig.baseCollection
const rootConfig = await program.account.rootConfig.fetch(rootConfigPda);
const collectionPubkey = rootConfig.baseCollection;

const [registryConfigPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("registry_config"), collectionPubkey.toBuffer()],
  REGISTRY_PROGRAM_ID
);

await program.methods
  .register("https://example.com/agent-metadata.json")
  .accounts({
    rootConfig: rootConfigPda,
    registryConfig: registryConfigPda,
    agentAccount: agentPda,
    asset: assetKeypair.publicKey,
    collection: collectionPubkey,
    owner: wallet.publicKey,
    payer: wallet.publicKey,
    systemProgram: SystemProgram.programId,
    mplCoreProgram: new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
  })
  .signers([assetKeypair])
  .rpc();
```

---

## 3. Critical CPI Challenge: Asset as Signer

**This is the most important finding for Preventra integration.**

The `Register` context requires:
```rust
pub asset: Signer<'info>  // Fresh keypair that signs the transaction
```

This means the `asset` account (which becomes the Metaplex Core NFT) must be a **new Keypair that signs the transaction**. In a CPI from Preventra's `register()` instruction, we face a fundamental problem:

- Preventra's program cannot generate a new Keypair during execution
- Preventra's program cannot sign on behalf of an externally-generated keypair (it is not a PDA of Preventra)
- The asset keypair must be passed as a signer from the client, which means the client must generate it

### 3.1 Integration Options

**Option A: Two-Transaction Approach (Recommended for Phase 0)**
1. Client generates asset Keypair
2. Transaction 1: Client calls QuantuLabs `register()` directly via SDK, passing asset Keypair as signer
3. Transaction 2: Client calls Preventra `register()` with the asset pubkey as `agent_identity`
4. Preventra reads the QuantuLabs AgentAccount PDA to verify the identity exists and the caller owns it

Pros: Simple, no CPI complexity, works today. Cons: Two transactions, identity creation is not atomic with vault/provenance creation.

**Option B: Passthrough CPI (Complex, Phase 1+)**
1. Client generates asset Keypair and passes it to Preventra's `register()`
2. Preventra CPIs into QuantuLabs `register()`, forwarding the asset Keypair as a signer
3. Anchor supports forwarding external signers via `ctx.remaining_accounts` or explicit account passthrough

Pros: Single transaction, atomic. Cons: Complex account plumbing, 8+ accounts to forward, compute budget concerns, tight coupling to QuantuLabs account layout.

**Option C: Mock Identity (De-risk, approved by Stratburt)**
1. Use a Keypair-generated Pubkey as `agent_identity` for Steps 3-4
2. No QuantuLabs dependency during core IP development
3. Layer in real integration (Option A or B) in Step 5

Pros: Core IP never blocked by external dependency. Cons: None for Phase 0.

### 3.2 Recommendation

Follow Stratburt's approved de-risk strategy:
- **Steps 3-4:** Mock identity (Option C)
- **Step 5:** Option A (two-transaction) for initial integration
- **Phase 1:** Evaluate Option B if single-transaction atomicity becomes a requirement

---

## 4. AgentAccount Structure (Full Schema)

```rust
pub struct AgentAccount {
    pub collection: Pubkey,           // Collection this agent belongs to
    pub creator: Pubkey,              // Immutable, set at registration
    pub owner: Pubkey,                // Cached from Core asset
    pub asset: Pubkey,                // Metaplex Core asset (unique ID)
    pub bump: u8,                     // PDA bump
    pub atom_enabled: bool,           // One-way flag
    pub agent_wallet: Option<Pubkey>, // Ed25519 verified wallet
    pub feedback_digest: [u8; 32],    // Hash-chain for feedback
    pub feedback_count: u64,
    pub response_digest: [u8; 32],    // Hash-chain for responses
    pub response_count: u64,
    pub revoke_digest: [u8; 32],      // Hash-chain for revocations
    pub revoke_count: u64,
    pub parent_asset: Option<Pubkey>, // Parent link (first-write-wins)
    pub parent_locked: bool,
    pub col_locked: bool,             // Collection pointer lock
    pub agent_uri: String,            // Max 250 bytes
    pub nft_name: String,             // Max 32 bytes
    pub col: String,                  // Max 128 bytes, format: c1:<cid_norm>
}
```

**PDA derivation:** `[b"agent", asset.key().as_ref()]` using the QuantuLabs program ID.

---

## 5. PDA Seeds Reference

| PDA | Seeds | Program |
|-----|-------|---------|
| RootConfig | `["root_config"]` | Agent Registry |
| RegistryConfig | `["registry_config", collection.key()]` | Agent Registry |
| AgentAccount | `["agent", asset.key()]` | Agent Registry |
| MetadataEntryPda | `["agent_meta", asset.key(), key_hash[0..16]]` | Agent Registry |
| AtomConfig | `["atom_config"]` | ATOM Engine |
| AtomStats | `["atom_stats", asset.key()]` | ATOM Engine |
| Registry CPI Authority | `["atom_cpi_authority"]` | Agent Registry |

---

## 6. Post-Registration Operations (Available to Preventra SDK)

These are QuantuLabs instructions Preventra's SDK can wrap for agent management:

| Instruction | Signer | Purpose |
|-------------|--------|---------|
| `set_agent_uri(new_uri)` | Owner | Update agent metadata URI |
| `set_metadata_pda(key_hash, key, value, immutable)` | Owner | Set individual metadata key-value |
| `delete_metadata_pda(key_hash)` | Owner | Delete metadata, recover rent |
| `enable_atom()` | Owner | One-way ATOM Engine activation |
| `sync_owner()` | Permissionless | Refresh cached owner from Core asset |
| `transfer_agent()` | Owner | Transfer with automatic owner sync |
| `set_agent_wallet(new_wallet, deadline)` | Owner | Ed25519 signature verified wallet set |
| `set_collection_pointer(col)` | Creator | First-write-wins, c1:cid format |
| `set_parent_asset(parent_asset)` | Owner | First-write-wins parent link |
| `owner_of()` | N/A (view) | Get cached owner |
| `core_owner_of()` | N/A (view) | Get live owner from Metaplex Core |

---

## 7. Error Codes (QuantuLabs, IDL-reported base offset 12000)

**Note:** The IDL reports error codes starting at 12000 (Anchor base 6000 + 6000 offset). The Rust source uses Anchor's default numbering starting at 6000. The actual on-chain codes match the IDL values (12000+).

Key error codes relevant to Preventra integration:

| Code (IDL) | Name | Message |
|------------|------|---------|
| 12000 | UriTooLong | URI exceeds 250 bytes |
| 12004 | Unauthorized | Unauthorized |
| 12010 | InvalidCollection | Invalid collection |
| 12011 | InvalidAsset | Invalid asset |
| 12251 | RootAlreadyInitialized | Root config already initialized |
| 12400 | InvalidProgram | Invalid program ID for CPI call |

---

## 8. Dependencies and Version Compatibility

| Package | QuantuLabs Version | Notes |
|---------|-------------------|-------|
| `@coral-xyz/anchor` | 0.31.1 | Preventra uses Anchor 0.32.1, should be compatible |
| `@metaplex-foundation/js` | ^0.20.1 | For Metaplex Core operations |
| `@solana/web3.js` | Standard | No version conflicts expected |
| `tweetnacl` | ^1.0.3 | For Ed25519 signature operations |

**Anchor version gap:** QuantuLabs built with 0.31.1, Preventra will use 0.32.1. The IDL format is compatible (both use spec 0.1.0). CPI calls do not depend on matching Anchor versions -- they use raw instruction data. No issues expected.

---

## 9. Devnet Initialization Requirement

Before Preventra can register agents via QuantuLabs on devnet, the QuantuLabs registry must be initialized. This requires:

1. The registry `Initialize` instruction must have been called by the **upgrade authority** of the QuantuLabs program
2. This creates `RootConfig` and `RegistryConfig` PDAs, and a Metaplex Core Collection
3. The `collection` address is stored in `RootConfig.base_collection`

**Risk:** If the QuantuLabs devnet registry is not initialized, or gets reset, Preventra cannot register identities. This is another reason the mock identity de-risk strategy is correct for Phase 0.

**Mitigation:** In Step 5, the Preventra SDK should first verify the RootConfig PDA exists and is valid before attempting registration. If it does not exist, return a clear error: "QuantuLabs registry not initialized on this cluster."

---

## 10. Quirks and Limitations

1. **NFT name is hardcoded to "Agent"** in the registration instruction. The `nft_name` field on `AgentAccount` stores this, but there is no way to set a custom name at registration time. Agent differentiation comes from the `agent_uri` metadata link.

2. **No sequential agent IDs.** QuantuLabs uses the `asset` Pubkey as the unique identifier (EVM conformity design). This means Preventra cannot assign "Agent #1" at the protocol level -- numbering would need to happen in Preventra's own state or off-chain.

3. **ATOM Engine is optional but defaults to enabled.** Use `register_with_options(uri, false)` to register without ATOM. Once enabled, ATOM cannot be disabled (one-way flag).

4. **Owner is cached, not live.** The `AgentAccount.owner` field is set at registration and updated via `sync_owner()` or `transfer_agent()`. If someone transfers the Metaplex Core asset externally (outside QuantuLabs), the owner cache becomes stale until `sync_owner()` is called.

5. **Ed25519 signature requirement for wallet.** Setting the agent wallet requires a pre-verified Ed25519 signature in the transaction's instruction sysvar. This is a strict security model: the wallet key must prove it controls the private key.

6. **Collection pointer format.** Must follow `c1:<cid_norm>` format, max 128 bytes. First-write-wins with optional lock.

7. **Metadata uses SHA256 key hashing.** Keys are hashed with SHA256 and truncated to 16 bytes for PDA derivation. The full key is stored on-chain for verification. This provides 2^128 collision resistance.

8. **Account size is dynamic.** AgentAccount uses `InitSpace` derive macro, meaning size is calculated from field types. The variable-length String fields (agent_uri, nft_name, col) use Borsh length-prefixed encoding.

---

## 11. Preventra Integration Architecture (Recommended)

### For Preventra's `register()` instruction (Step 5):

```
Client-side (TypeScript SDK):
1. Generate asset Keypair
2. Call QuantuLabs register() -> creates identity
3. Call Preventra register(asset_pubkey, ...) -> creates vault + provenance
4. SDK wraps both calls in a clean preventra.register({...}) method
```

### For Preventra's VaultAccount and ProvenanceRecord:

```
VaultAccount PDA: ["vault", agent_identity.as_ref()]
  where agent_identity = QuantuLabs asset Pubkey (or mock Pubkey in Steps 3-4)

ProvenanceRecord PDA: ["provenance", agent_identity.as_ref()]
  where agent_identity = same as above
```

### Verification in Preventra's register():

When using real QuantuLabs integration (Step 5), Preventra's `register()` should:
1. Accept the asset Pubkey as an argument
2. Derive the QuantuLabs AgentAccount PDA: `["agent", asset.as_ref()]` using QuantuLabs program ID
3. Read the AgentAccount to verify: (a) it exists, (b) caller is the owner
4. Initialize VaultAccount and ProvenanceRecord using the asset Pubkey

This means Preventra reads QuantuLabs state but does not CPI into it. Clean separation.

---

## 12. Files Referenced

All source files examined from `/tmp/quantulabs-research/8004-solana/`:

- `programs/agent-registry-8004/src/lib.rs` -- Program entry, all instruction definitions
- `programs/agent-registry-8004/src/identity/state.rs` -- Account structures
- `programs/agent-registry-8004/src/identity/instructions.rs` -- Instruction implementations
- `programs/agent-registry-8004/src/identity/contexts.rs` -- Anchor account contexts
- `programs/agent-registry-8004/src/identity/events.rs` -- Event definitions
- `programs/agent-registry-8004/src/constants.rs` -- PDA seed constants
- `programs/agent-registry-8004/src/error.rs` -- Error codes
- `programs/agent-registry-8004/src/core_asset.rs` -- Metaplex Core helpers
- `Anchor.toml` -- Configuration, program IDs, test validator setup
- `package.json` -- Dependencies
- `idl/agent_registry_8004.json` -- Full IDL (v0.5.2)
- `idl/atom_engine.json` -- ATOM Engine IDL (v0.2.2)
- `types/atom_engine.ts` -- TypeScript types for ATOM Engine
- `tests/identity-tests.ts` -- Full identity test suite
- `tests/init-localnet.ts` -- Initialization test
- `tests/utils/helpers.ts` -- PDA derivation helpers, test utilities

---

## Summary for Stratburt

**QuantuLabs 8004-solana is viable for Preventra identity integration.** The devnet program is live and the interface is well-documented through their IDL and test suite.

**The critical finding:** Single-transaction CPI registration is not straightforward because the Metaplex Core asset must be a fresh Keypair signer. The recommended approach for Step 5 is a two-transaction flow wrapped by the Preventra SDK, where identity creation happens first and Preventra verifies it by reading the QuantuLabs AgentAccount PDA.

**The de-risk strategy is validated:** Building Steps 3-4 with mock identity is the right call. Core IP (vault governance, build provenance) has zero dependency on QuantuLabs. When we layer in real integration in Step 5, we read QuantuLabs state rather than CPI into it, keeping the integration clean and debuggable.

**No blockers identified.** Ready to proceed with Step 2 (Anchor scaffold) upon Stratburt approval.
