use anchor_lang::prelude::*;
use crate::errors::PreventraError;
use crate::state::{VaultAccount, VaultStatus};

/// Pause an agent's vault. Blocks all withdrawals.
///
/// Owner only. Deposits continue to work while paused.
/// Only valid from Active state.
#[derive(Accounts)]
pub struct VaultPause<'info> {
    /// The vault to pause. Owner constraint enforced by has_one.
    #[account(
        mut,
        seeds = [b"vault", vault.agent_identity.as_ref()],
        bump = vault.bump,
        has_one = owner,
    )]
    pub vault: Account<'info, VaultAccount>,

    /// The vault owner. Must match vault.owner.
    pub owner: Signer<'info>,
}

/// Set vault status to Paused. Only valid from Active state.
pub fn handler(ctx: Context<VaultPause>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    require!(vault.status == VaultStatus::Active, PreventraError::VaultNotPausable);

    vault.status = VaultStatus::Paused;

    msg!("Vault paused for agent {}", vault.agent_identity);

    Ok(())
}
