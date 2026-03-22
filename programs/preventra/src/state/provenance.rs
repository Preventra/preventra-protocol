use anchor_lang::prelude::*;

/// Cryptographic build provenance record for an autonomous agent.
/// Tracks model identity, build hash mutations, and change history.
///
/// PDA seeds: [b"provenance", agent_identity.key().as_ref()]
///
/// Allocated 512 bytes to accommodate future fields without reallocation.
#[account]
#[derive(InitSpace)]
pub struct ProvenanceRecord {
    /// PDA bump seed for derivation verification
    pub bump: u8,

    /// The agent identity this provenance record tracks.
    /// Same Pubkey used for VaultAccount derivation.
    pub agent_identity: Pubkey,

    /// Wallet that owns and controls this provenance record.
    pub owner: Pubkey,

    /// Current model identifier (e.g., "claude-opus-4-6"). Max 64 bytes.
    #[max_len(64)]
    pub model: String,

    /// Current build hash. SHA-256 of the agent's deployed code or config.
    pub build_hash: [u8; 32],

    /// Build hash recorded at registration time. Immutable reference point.
    /// Used to determine if the agent has ever diverged from its original build.
    pub initial_build_hash: [u8; 32],

    /// True if current build_hash differs from initial_build_hash.
    /// Resets to false if the agent returns to the original build hash.
    /// The change_count field preserves full mutation history regardless.
    pub model_changed: bool,

    /// Total number of provenance updates. Never decreases.
    /// If change_count > 0, the agent's build has been modified at some point,
    /// even if model_changed is currently false (A > B > A scenario).
    pub change_count: u64,

    /// Unix timestamp of the most recent provenance update.
    pub last_verified: i64,

    /// Unix timestamp when this provenance record was created.
    pub created_at: i64,

    /// Reserved bytes for future upgrades without reallocation.
    #[max_len(64)]
    pub reserved: Vec<u8>,
}
