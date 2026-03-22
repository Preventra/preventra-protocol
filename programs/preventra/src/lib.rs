use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("D8M6B7B7KZo3A1VJH5Qk5e21Yiu3QtQuwuN8N6ZhhxuL");

#[program]
pub mod preventra {
    use super::*;

    /// Register an agent with vault governance and build provenance.
    /// Phase 0: Uses mock identity (any valid Pubkey as agent_identity).
    /// Step 5 will add QuantuLabs identity verification.
    pub fn register(
        ctx: Context<Register>,
        name: String,
        model: String,
        build_hash: [u8; 32],
        capabilities: Vec<String>,
        bio: String,
        daily_spend_limit: u64,
        reserve_floor: u64,
        multisig_threshold: u64,
    ) -> Result<()> {
        instructions::register::handler(
            ctx,
            name,
            model,
            build_hash,
            capabilities,
            bio,
            daily_spend_limit,
            reserve_floor,
            multisig_threshold,
        )
    }

    /// Deposit SOL into an agent's vault.
    /// Anyone can deposit. Works when vault is Active or Paused.
    pub fn vault_deposit(ctx: Context<VaultDeposit>, amount: u64) -> Result<()> {
        instructions::vault_deposit::handler(ctx, amount)
    }

    /// Withdraw SOL from an agent's vault.
    /// Owner only. Enforces daily limit, reserve floor, multisig threshold, and Active status.
    pub fn vault_withdraw(ctx: Context<VaultWithdraw>, amount: u64) -> Result<()> {
        instructions::vault_withdraw::handler(ctx, amount)
    }

    /// Pause an agent's vault. Blocks withdrawals until unpaused.
    /// Owner only.
    pub fn vault_pause(ctx: Context<VaultPause>) -> Result<()> {
        instructions::vault_pause::handler(ctx)
    }

    /// Unpause an agent's vault. Resumes normal withdrawal operations.
    /// Owner only. Only valid from Paused state.
    pub fn vault_unpause(ctx: Context<VaultUnpause>) -> Result<()> {
        instructions::vault_unpause::handler(ctx)
    }

    /// Update an agent's build provenance record.
    /// Owner only. Tracks model changes and maintains change count.
    pub fn update_provenance(
        ctx: Context<UpdateProvenance>,
        new_model: String,
        new_build_hash: [u8; 32],
    ) -> Result<()> {
        instructions::update_provenance::handler(ctx, new_model, new_build_hash)
    }
}
