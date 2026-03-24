# Agent Permissions Scope: Codeburt

## What This Document Is

This is a real-time permissions audit of Codeburt, FixCore's lead development agent, operating through Claude Code. It documents what this agent CAN access, what it CANNOT access, what governance SHOULD enforce, and what does not exist yet.

This is not theoretical. This is Preventra's thesis demonstrated by our own team: autonomous agents need governance, and the first step is transparency about what they can do.

## Current Access (What Codeburt CAN Do)

### Filesystem
- Full read/write access to the local filesystem
- Can create, modify, and delete any file the host user can access
- No sandboxing beyond OS-level user permissions
- Can read SSH keys, environment variables, and configuration files

### Git and Version Control
- Full git operations: commit, push, pull, branch, merge, rebase
- GitHub API access via `gh` CLI (authenticated as `fixcoreai-cloud`)
- Can create repos, branches, PRs, issues, and manage branch protection
- Can push code to any repo the authenticated GitHub account has access to

### Terminal and Shell
- Full bash/zsh execution with the host user's PATH and environment
- Can install packages (npm, cargo, pip, brew)
- Can start and stop processes, servers, and background tasks
- Can execute arbitrary shell commands with no approval gate

### Network
- Outbound HTTP/HTTPS requests (curl, fetch, web APIs)
- Can interact with any reachable API endpoint
- Can download and execute remote scripts
- Solana CLI: can sign and submit transactions to any cluster

### Solana and Blockchain
- Full Solana CLI access (keygen, deploy, transfer, airdrop)
- Anchor framework: build, test, deploy programs
- Access to wallet keypair files on disk
- Can deploy programs and submit transactions that spend SOL

### Notion (via MCP)
- Read/write access to Notion databases and pages
- Can create pages, update properties, append content blocks
- Can query databases (Activity Log, Pipeline Tracker, Content Research Feed)
- Can search across the entire Notion workspace

### GitHub (via MCP)
- Repository management (create, search, get contents)
- Issue and PR management (create, update, comment, merge)
- Code search across repositories
- Branch operations and file management

## Current Restrictions (What Codeburt CANNOT Do)

### No Direct Communication Channel
- Cannot message other Burts directly (Stratburt, Buildburt, Clawburt)
- All inter-agent communication is relayed by Patrick via copy-paste
- No persistent message queue or event bus between agents

### No Gmail or Calendar Access
- Cannot send emails
- Cannot read or create calendar events
- Cannot trigger notifications to Patrick's phone

### No Financial Account Access
- No access to Stripe, bank accounts, or payment systems
- Cannot initiate real-money transactions
- Devnet SOL is the only "spend" capability (valueless test tokens)

### No Persistent State Across Sessions
- Each Claude Code session starts fresh (no memory of previous sessions beyond MEMORY.md files)
- No long-running background processes that survive session termination
- Cannot self-restart or self-heal if the terminal closes

### No Self-Modification
- Cannot modify its own system prompt or CLAUDE.md during execution
- Cannot upgrade its own model or change its operating parameters
- Cannot grant itself additional tool access

## What Governance SHOULD Enforce (The Gap)

These are the controls that do not exist today but should. This is exactly what Preventra is being built to provide.

### Spending Governance
- **Daily compute budget**: No limit on how many API calls, builds, or deploys Codeburt triggers per day. A VaultAccount-style daily_spend_limit should apply to compute costs, not just SOL.
- **Deploy approval gate**: Codeburt can deploy to devnet without any approval. Mainnet deploys should require multisig or owner approval, enforced on-chain.
- **Package installation limits**: No governance on what packages get installed. A malicious dependency could be pulled without review.

### Action Audit Trail
- **No on-chain provenance for actions**: Codeburt's git commits create a paper trail, but there is no cryptographic proof linking actions to a verified agent identity. ProvenanceRecord tracks build hashes but not individual operations.
- **No tamper-proof action log**: Session logs exist locally but can be deleted. An immutable on-chain or append-only log of significant actions (deploys, transfers, file deletions) does not exist.

### Identity Verification
- **No verified agent identity**: Codeburt operates under Patrick's filesystem user and GitHub account. There is no independent cryptographic identity that proves "this action was taken by Codeburt, not by Patrick or another agent."
- **No capability attestation**: Nothing verifiable proves Codeburt has the capabilities it claims (strategy, operations, content). The capabilities field in the registration is self-reported.

### Rate Limiting and Circuit Breakers
- **No rate limits on destructive actions**: Codeburt could delete every file on disk in a single command. No circuit breaker exists.
- **No rollback mechanism**: If Codeburt pushes bad code, the only recovery is manual git revert. No automated rollback triggered by failed health checks.
- **No pause mechanism**: Unlike VaultAccount's pause/unpause, there is no way to freeze Codeburt's operations without closing the terminal.

### Inter-Agent Governance
- **No permission boundaries between agents**: If Clawburt and Codeburt share the same filesystem, nothing prevents one from modifying the other's files.
- **No resource allocation**: No mechanism to ensure one agent does not consume all compute, network, or storage resources.
- **No conflict resolution**: If two agents try to modify the same file simultaneously, the result is undefined.

## The Preventra Connection

Every gap listed above maps directly to a Preventra feature, either built in Phase 0 or planned for later phases:

| Gap | Preventra Feature | Phase |
|-----|-------------------|-------|
| No spending limits on compute | VaultAccount daily_spend_limit | 0 (built) |
| No deploy approval gate | VaultAccount multisig_threshold | 0 (built) |
| No emergency stop | VaultAccount pause/unpause | 0 (built) |
| No action provenance | ProvenanceRecord build_hash tracking | 0 (built) |
| No verified identity | Agent identity via QuantuLabs 8004-solana | 1 (planned) |
| No tamper-proof logs | On-chain event log per agent | 1 (planned) |
| No inter-agent boundaries | Agent-scoped permission sets | 2 (planned) |
| No capability attestation | Verifiable capability proofs | 2 (planned) |

We are building the governance we need. And we are the first team that needs it.

## Revision History

| Date | Change |
|------|--------|
| 2026-03-23 | Initial permissions audit (Codeburt, Phase 0) |
