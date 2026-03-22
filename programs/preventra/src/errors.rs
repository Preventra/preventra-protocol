use anchor_lang::prelude::*;

/// Preventra protocol error codes.
/// Range 6000-6014 reserved for Phase 0 instructions.
#[error_code]
pub enum PreventraError {
    // === Registration errors (6000-6005) ===

    /// Agent name exceeds 32 characters.
    #[msg("Agent name exceeds maximum length of 32 characters")]
    NameTooLong, // 6000

    /// Agent model string exceeds 64 characters.
    #[msg("Model identifier exceeds maximum length of 64 characters")]
    ModelTooLong, // 6001

    /// Too many capabilities. Maximum is 8.
    #[msg("Capabilities list exceeds maximum of 8 entries")]
    TooManyCapabilities, // 6002

    /// A single capability string exceeds 32 characters.
    #[msg("Individual capability exceeds maximum length of 32 characters")]
    CapabilityTooLong, // 6003

    /// Agent bio exceeds 256 characters.
    #[msg("Agent bio exceeds maximum length of 256 characters")]
    BioTooLong, // 6004

    /// Identity verification failed. The provided identity does not exist
    /// or the signer does not own it. (Used in Step 5 with QuantuLabs integration.)
    #[msg("Identity verification failed: identity not found or not owned by signer")]
    IdentityVerificationFailed, // 6005

    // === Vault errors (6006-6012) ===

    /// Deposit amount must be greater than zero.
    #[msg("Deposit amount must be greater than zero")]
    InvalidDepositAmount, // 6006

    /// Withdrawal amount must be greater than zero.
    #[msg("Withdrawal amount must be greater than zero")]
    InvalidWithdrawAmount, // 6007

    /// Insufficient vault balance for this withdrawal.
    #[msg("Insufficient vault balance for withdrawal")]
    InsufficientBalance, // 6008

    /// Withdrawal would breach the vault's reserve floor.
    #[msg("Withdrawal rejected: would breach reserve floor")]
    ReserveFloorBreach, // 6009

    /// Withdrawal exceeds the daily spending limit.
    #[msg("Withdrawal rejected: daily spending limit exceeded")]
    DailyLimitExceeded, // 6010

    /// Withdrawal exceeds the multisig threshold. Multi-signature approval required.
    #[msg("Withdrawal rejected: amount exceeds multisig threshold, multi-signature approval required")]
    MultisigThresholdExceeded, // 6011

    /// Vault is paused. Withdrawals are blocked until the owner unpauses.
    #[msg("Vault is paused: withdrawals blocked until owner unpauses")]
    VaultPaused, // 6012

    // === Provenance errors (6013-6014) ===

    /// Vault is not in a pausable state (already paused or frozen).
    #[msg("Vault cannot be paused from its current state")]
    VaultNotPausable, // 6013

    /// Vault is not in Paused state, cannot unpause.
    #[msg("Vault is not paused, cannot unpause")]
    VaultNotPaused, // 6014
}
