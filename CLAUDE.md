# Preventra Protocol

## What This Is
Governance, trust, and provenance layer for autonomous AI agents on Solana. This is FixCore's core IP product. Prevents autonomous intelligence from going wrong.

## Architecture
- **VaultAccount**: Treasury governance with daily spend limits, reserve floors, multisig thresholds, pause/unpause
- **ProvenanceRecord**: Cryptographic build provenance tracking model changes and mutation history
- **Identity**: Phase 0 uses mock identity (Keypair Pubkey). Step 5+ integrates QuantuLabs 8004-solana for ERC-8004 agent identity

## Project Structure
```
programs/preventra/src/
  lib.rs              # Program entry, instruction dispatch
  errors.rs           # Error codes 6000-6014
  state/
    vault.rs          # VaultAccount struct
    provenance.rs     # ProvenanceRecord struct
  instructions/
    register.rs       # Create identity + vault + provenance
    vault_deposit.rs  # Deposit SOL (permissionless)
    vault_withdraw.rs # Withdraw SOL (owner, with governance)
    vault_pause.rs    # Emergency pause
    vault_unpause.rs  # Resume operations
    update_provenance.rs # Update build hash and model
sdk/typescript/src/   # TypeScript SDK (@preventra/sdk)
tests/preventra.ts    # 15 test cases
scripts/              # Deploy and registration scripts
```

## Coding Standards

### Hard Rules
- **No em dashes.** Use commas, periods, or "and" in all comments, docs, and strings.
- **No `unwrap()` in production Rust.** Use proper error handling with `?` or `ok_or()`.
- **No `any` type in TypeScript.** Non-negotiable.
- **Comments explain WHY, not WHAT.**
- **Every public function gets a doc comment.** This is open-source.

### Rust Conventions
- Use `require!()` macro for input validation
- Use `checked_add()`, `checked_sub()`, `saturating_add()` for arithmetic
- PDA seeds as byte literals: `[b"vault", key.as_ref()]`
- Error codes are sequential starting at 6000
- Account space: `8 + Type::INIT_SPACE` (8 bytes for Anchor discriminator)

### TypeScript Conventions
- ES modules only
- Named exports
- async/await
- Explicit error handling, no silent catches

## Common Commands
```bash
anchor build           # Build the program
anchor test            # Run all 15 tests
anchor deploy          # Deploy to configured cluster
yarn build             # Build TypeScript SDK (from sdk/typescript/)
```

## PDA Seeds
| Account | Seeds |
|---------|-------|
| VaultAccount | `["vault", agent_identity.key()]` |
| ProvenanceRecord | `["provenance", agent_identity.key()]` |

## Error Codes
| Range | Domain |
|-------|--------|
| 6000-6005 | Registration validation |
| 6006-6012 | Vault governance |
| 6013-6014 | Vault state transitions |

## Git
```bash
git config user.email "fixcore.ai@gmail.com"
git config user.name "Patrick Boudreau"
```
Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`

## Key Design Decisions
1. **Mock identity de-risk**: Core IP (vault + provenance) built independently of QuantuLabs. Uses any Pubkey as agent_identity.
2. **Two-transaction registration** (Step 5): Client creates QuantuLabs identity first, then calls Preventra register. Preventra reads QuantuLabs state but never CPIs into it.
3. **Daily limit uses >= comparison**: Deterministic reset, no clock drift edge cases.
4. **Reserved bytes in accounts**: 64-byte Vec<u8> for future upgrades without reallocation.
5. **model_changed + change_count**: model_changed can reset (A > B > A), but change_count never decreases. Count is the audit trail.
