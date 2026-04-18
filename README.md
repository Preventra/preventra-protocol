> # ARCHIVED
>
> This repository is preserved as a read-only historical reference. It contains the Phase 0 exploration under a previous Preventra vision and is no longer maintained.
>
> **The active Preventra project is at [github.com/Preventra/preventra](https://github.com/Preventra/preventra).**
>
> The code and documentation below are retained for transparency and historical continuity. They do not reflect the current direction of the protocol.
>
> ---

# Preventra Protocol

Governance, trust, and provenance for autonomous AI agents on Solana.

Preventra is the governance layer that prevents autonomous intelligence from going wrong. It provides vault governance with daily spending limits, reserve floors, and multisig thresholds, plus cryptographic build provenance tracking for AI agents operating on-chain.

## Quickstart

Clone, install, and register an agent in under 10 minutes.

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Solana CLI](https://docs.solana.com/cli/install) (v3.x)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) (v0.32.1)
- [Yarn](https://yarnpkg.com/)

### Setup

```bash
git clone https://github.com/Preventra/preventra-protocol.git
cd preventra-protocol
yarn install
```

### Build

```bash
anchor build
```

### Test

```bash
anchor test
```

This runs all 15 tests covering registration, vault governance, and build provenance.

### Deploy to Devnet

```bash
solana config set --url devnet
anchor deploy --provider.cluster devnet
```

## Architecture

Preventra manages two core account types per agent:

### VaultAccount

Treasury governance for autonomous agents. Controls how agents spend funds.

- **Daily spend limit** - Maximum SOL withdrawable per 24-hour window
- **Reserve floor** - Minimum balance that must remain in the vault
- **Multisig threshold** - Amount above which multi-signature approval is required
- **Pause/unpause** - Emergency stop for all withdrawals (deposits always accepted)

PDA: `[b"vault", agent_identity.key()]`

### ProvenanceRecord

Cryptographic build provenance for agent integrity verification.

- **build_hash** - SHA-256 hash of the agent's current build
- **initial_build_hash** - Original hash at registration, never changes
- **model_changed** - Whether current hash differs from initial
- **change_count** - Total number of updates (never decreases, even if hash returns to original)

PDA: `[b"provenance", agent_identity.key()]`

## Instructions

| Instruction | Signer | Status Required |
|---|---|---|
| `register` | owner + agent_identity | N/A (creates accounts) |
| `vault_deposit` | anyone | Active or Paused |
| `vault_withdraw` | owner | Active only |
| `vault_pause` | owner | Active only |
| `vault_unpause` | owner | Paused only |
| `update_provenance` | owner | N/A |

## Error Codes

| Code | Name | Description |
|---|---|---|
| 6000 | NameTooLong | Agent name exceeds 32 characters |
| 6001 | ModelTooLong | Model identifier exceeds 64 characters |
| 6002 | TooManyCapabilities | More than 8 capabilities |
| 6003 | CapabilityTooLong | Single capability exceeds 32 characters |
| 6004 | BioTooLong | Bio exceeds 256 characters |
| 6005 | IdentityVerificationFailed | Identity not found or not owned by signer |
| 6006 | InvalidDepositAmount | Deposit amount is zero |
| 6007 | InvalidWithdrawAmount | Withdrawal amount is zero |
| 6008 | InsufficientBalance | Not enough SOL in vault |
| 6009 | ReserveFloorBreach | Withdrawal would drop below reserve floor |
| 6010 | DailyLimitExceeded | Would exceed 24-hour spending limit |
| 6011 | MultisigThresholdExceeded | Single withdrawal above multisig threshold |
| 6012 | VaultPaused | Vault is paused, withdrawals blocked |
| 6013 | VaultNotPausable | Cannot pause from current state |
| 6014 | VaultNotPaused | Vault is not paused, cannot unpause |

## Project Structure

```
preventra-protocol/
  programs/preventra/src/
    lib.rs              # Program entry point
    errors.rs           # Error codes 6000-6014
    state/
      vault.rs          # VaultAccount struct
      provenance.rs     # ProvenanceRecord struct
    instructions/
      register.rs       # Agent registration
      vault_deposit.rs  # Permissionless deposit
      vault_withdraw.rs # Governed withdrawal
      vault_pause.rs    # Emergency pause
      vault_unpause.rs  # Resume operations
      update_provenance.rs  # Build hash updates
  sdk/typescript/       # TypeScript SDK
  tests/preventra.ts    # 15 test cases
  scripts/              # Deployment and registration scripts
```

## Identity Integration

Phase 0 uses mock identities (any valid Keypair as agent_identity). Step 5 integrates QuantuLabs 8004-solana for ERC-8004 compliant agent identity. Preventra reads identity state but never CPIs into the identity program, keeping the governance layer independent.

See [integration-notes.md](integration-notes.md) for full QuantuLabs integration reference.

## Program ID

Devnet: `D8M6B7B7KZo3A1VJH5Qk5e21Yiu3QtQuwuN8N6ZhhxuL`

## License

Apache 2.0. See [LICENSE](LICENSE).

## Built by

[FixCore](https://fixcore.ai) - AI-powered intelligent business systems.
