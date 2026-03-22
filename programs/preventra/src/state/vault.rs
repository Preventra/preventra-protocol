use anchor_lang::prelude::*;

/// Vault status controlling withdrawal permissions.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum VaultStatus {
    /// Normal operation. Deposits and withdrawals permitted.
    Active,
    /// Emergency pause. Deposits allowed, withdrawals blocked.
    Paused,
}

/// Treasury governance account for an autonomous agent.
/// Controls spending limits, reserve floors, and pause functionality.
///
/// PDA seeds: [b"vault", agent_identity.key().as_ref()]
///
/// Allocated 512 bytes to accommodate future fields without reallocation.
#[account]
#[derive(InitSpace)]
pub struct VaultAccount {
    /// PDA bump seed for derivation verification
    pub bump: u8,

    /// The agent identity this vault governs.
    /// Phase 0: Mock identity (Keypair-generated Pubkey).
    /// Step 5+: QuantuLabs 8004 asset Pubkey.
    pub agent_identity: Pubkey,

    /// Wallet that owns and controls this vault.
    /// Only the owner can withdraw, pause, and unpause.
    pub owner: Pubkey,

    /// Current vault balance in lamports.
    /// Updated on every deposit and withdrawal.
    pub balance: u64,

    /// Cumulative SOL deposited over the vault's lifetime (lamports).
    pub total_deposited: u64,

    /// Cumulative SOL withdrawn over the vault's lifetime (lamports).
    pub total_withdrawn: u64,

    /// Maximum lamports the owner can withdraw in a 24-hour window.
    /// Reset when current_time - last_spend_reset >= 86400 seconds.
    pub daily_spend_limit: u64,

    /// Lamports spent in the current 24-hour window.
    /// Resets to 0 when the daily window expires.
    pub daily_spent: u64,

    /// Unix timestamp of the last daily spending reset.
    /// Used with >= comparison for deterministic reset behavior.
    pub last_spend_reset: i64,

    /// Minimum balance that must remain in the vault after any withdrawal.
    /// Withdrawals that would drop balance below this floor are rejected.
    pub reserve_floor: u64,

    /// Withdrawal amount threshold requiring multi-signature approval.
    /// Single withdrawals above this amount are rejected in Phase 0.
    /// Phase 1+ will implement actual multi-sig approval flow.
    pub multisig_threshold: u64,

    /// Current vault operational status (Active or Paused).
    pub status: VaultStatus,

    /// Unix timestamp when this vault was created.
    pub created_at: i64,

    /// Reserved bytes for future upgrades without reallocation.
    /// 64 bytes covers several additional Pubkey or u64 fields.
    #[max_len(64)]
    pub reserved: Vec<u8>,
}
