# Preventra Protocol Whitepaper

**Version 0.1.0 -- Phase 0**
**March 2026**

---

## Abstract

Autonomous AI agents are executing transactions, managing treasuries, and making decisions on-chain. The infrastructure assumes they are trustworthy. Preventra does not.

Preventra is a Solana-based governance protocol that provides treasury controls, build provenance verification, and identity-linked accountability for autonomous AI agents. It is the governance layer that prevents autonomous intelligence from going wrong.

---

## 1. Problem

The deployment of autonomous AI agents into financial systems introduces three critical risks that existing infrastructure does not address:

**Uncontrolled spending.** An agent with access to a treasury can drain it in a single transaction. There is no protocol-level mechanism to enforce spending limits, reserve requirements, or emergency stops.

**Unverified builds.** When an agent's model or codebase changes, there is no on-chain record. Operators cannot distinguish a legitimate update from a compromised deployment. The agent's identity persists, but its behavior may have changed entirely.

**No accountability chain.** Agent identities exist in isolation. There is no standardized way to link an agent's on-chain activity to its build artifacts, its operator, or its governance constraints. When something goes wrong, there is no audit trail.

---

## 2. Solution

Preventra introduces two on-chain account types that attach governance and provenance to every registered agent:

### 2.1 VaultAccount

A treasury governance layer that controls how agents spend funds. Each agent's vault enforces:

- **Daily spend limit.** Maximum withdrawable SOL within a rolling 24-hour window. The window resets deterministically based on Unix timestamp comparison, handling clock drift gracefully.

- **Reserve floor.** Minimum balance that must remain in the vault at all times. Withdrawals that would breach this floor are rejected.

- **Multisig threshold.** Transaction amount above which multi-signature approval is required (enforced in Phase 1; Phase 0 records the threshold and rejects single-signer withdrawals exceeding it).

- **Emergency pause.** The vault owner can pause all withdrawals immediately. Deposits remain accepted while paused, ensuring the vault can still receive funds during an incident.

These constraints are enforced at the protocol level. An agent cannot bypass them regardless of its own logic or instructions.

**PDA derivation:** `["vault", agent_identity.key()]`

### 2.2 ProvenanceRecord

A cryptographic build provenance system that tracks an agent's integrity over time:

- **build_hash.** A 32-byte SHA-256 hash of the agent's current build artifacts. Updated by the owner when the agent is redeployed.

- **initial_build_hash.** The hash recorded at registration. Immutable. Provides a permanent reference point.

- **model_changed.** Boolean flag indicating whether the current build hash differs from the initial hash. If the agent returns to its original build, this flag resets to false.

- **change_count.** Monotonically increasing counter of all provenance updates. Even if an agent cycles through A, B, C, and back to A, the change count reads 3. This preserves the historical signal that modifications occurred.

- **last_verified.** Timestamp of the most recent provenance update.

The combination of `model_changed` and `change_count` provides a layered signal. An operator can see both the current state (has the build changed?) and the history (how many times has it been modified?).

**PDA derivation:** `["provenance", agent_identity.key()]`

---

## 3. Architecture

### 3.1 Registration

A single `register()` instruction creates both the VaultAccount and ProvenanceRecord for a new agent. The caller provides:

- Agent name (max 32 characters)
- Model identifier (max 64 characters)
- Build hash (32 bytes, SHA-256)
- Capabilities list (max 8 items, each max 32 characters)
- Bio (max 256 characters)
- Governance parameters: daily spend limit, reserve floor, multisig threshold

The `agent_identity` keypair must sign the transaction, proving the caller controls the identity key. This keypair becomes the permanent link between the agent's identity and its governance accounts.

### 3.2 Identity Integration

Preventra is designed to work with the QuantuLabs 8004-solana identity registry, which implements the ERC-8004 standard for on-chain agent identity. The integration follows a two-transaction pattern:

1. The client registers an agent identity with QuantuLabs, receiving a Metaplex Core NFT as the identity asset.
2. The client registers governance with Preventra, using the same keypair.

Preventra reads QuantuLabs identity state but does not CPI into it. This keeps the governance layer independent of the identity layer, allowing either to be upgraded without breaking the other.

Phase 0 supports mock identities (any valid keypair) for development and testing. The on-chain program is identical for both mock and QuantuLabs-backed identities, since the constraint is simply that the keypair signs the transaction.

### 3.3 Instruction Set

| Instruction | Signer | Description |
|---|---|---|
| `register` | owner + agent_identity | Create vault and provenance for a new agent |
| `vault_deposit` | anyone | Deposit SOL into an agent's vault |
| `vault_withdraw` | owner | Withdraw SOL with governance enforcement |
| `vault_pause` | owner | Emergency pause on all withdrawals |
| `vault_unpause` | owner | Resume normal operations |
| `update_provenance` | owner | Update build hash and model |

### 3.4 Error Handling

Preventra uses 15 distinct error codes (6000-6014) with specific, actionable messages. When a withdrawal fails, the error tells the operator exactly why: daily limit exceeded, reserve floor breached, vault paused, or multisig threshold exceeded. Ambiguous errors are treated as bugs.

---

## 4. Security Model

**Owner authority.** The wallet that registers an agent is its permanent owner. Only the owner can withdraw funds, pause/unpause the vault, and update provenance. Ownership transfer is not supported in Phase 0.

**Permissionless deposits.** Anyone can deposit into any vault at any time, including when the vault is paused. This allows external funding and emergency capitalization without owner action.

**Signer verification.** The `agent_identity` keypair must sign the registration transaction. This prevents anyone from creating governance accounts for an identity they do not control.

**Deterministic resets.** The daily spend limit uses `>=` comparison for the 24-hour window reset, ensuring deterministic behavior regardless of Solana clock drift. Off-by-one errors at the boundary are eliminated.

**No admin keys.** Preventra has no global admin, upgrade authority override, or emergency backdoor. Each vault is governed solely by its owner.

---

## 5. TypeScript SDK

The `@preventra/sdk` package provides a clean TypeScript interface:

```typescript
import { Preventra } from "@preventra/sdk";

const preventra = new Preventra(connection, wallet);

// Register a new agent
const txSig = await preventra.register({
  name: "Clawburt",
  model: "claude-opus-4-6",
  buildHash: [...sha256Hash],
  capabilities: ["strategy", "operations", "content"],
  bio: "Chief of Staff AI.",
  dailySpendLimit: new BN(100_000_000_000),
  reserveFloor: new BN(500_000_000_000),
  multisigThreshold: new BN(1_000_000_000_000),
}, identityKeypair);

// Query vault state
const vault = await preventra.getVault(identityKeypair.publicKey);
```

Error handling returns human-readable messages: "Withdrawal rejected: daily spending limit exceeded (6010)" rather than raw Anchor error codes.

---

## 6. Roadmap

### Phase 0 (Current)
- VaultAccount with treasury governance
- ProvenanceRecord with build hash tracking
- Unified registration instruction
- TypeScript SDK with error parsing
- QuantuLabs 8004-solana identity integration (two-transaction flow)
- 15 test cases, devnet deployment

### Phase 1 (Planned)
- Multi-signature approval flow for withdrawals above threshold
- Reputation events and scoring
- USDC payment support
- Operator dashboard
- Full CPI integration with QuantuLabs (single-transaction registration)

### Phase 2 (Future)
- JobAccount and agent marketplace
- AgentChat protocol
- IPFS/Arweave provenance storage
- Governance token
- Cross-chain identity via CAIP-2

---

## 7. Conclusion

The gap between agent autonomy and agent accountability is widening. Agents are acquiring treasury access, executing financial operations, and making decisions with real consequences, while the infrastructure treats them as trusted signers with no governance constraints.

Preventra closes this gap at the protocol level. Not with external monitoring, not with off-chain policies, but with on-chain constraints that an agent cannot override. The vault does not care what the agent's instructions say. The provenance record does not care whether the model change was intentional. The protocol enforces the rules regardless.

Phase 0 delivers the foundation: treasury governance, build provenance, and a clean SDK. The protocol is live on Solana devnet. The first agent is registered. The governance layer exists.

---

## References

- [Preventra Protocol Repository](https://github.com/Preventra/preventra-protocol)
- [QuantuLabs 8004-solana](https://github.com/QuantuLabs/8004-solana)
- [Anchor Framework](https://www.anchor-lang.com/)
- [Solana Documentation](https://docs.solana.com/)
- [ERC-8004 Standard](https://eips.ethereum.org/EIPS/eip-8004)

---

**Built by [FixCore](https://fixcore.ai)**

Apache 2.0 License
