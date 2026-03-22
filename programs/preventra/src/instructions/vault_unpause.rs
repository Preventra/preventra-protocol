use anchor_lang::prelude::*;
use crate::errors::PreventraError;
use crate::state::{VaultAccount, VaultStatus};

/// Unpause an agent's vault. Resumes normal withdrawal operations.
///
/// Owner only. Only valid from Paused state.
#[derive(Accounts)]
pub struct VaultUnpause<'info> {
    /// The vault to unpause. Owner constraint enforced by has_one.
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

/// Set vault status back to Active. Only valid from Paused state.
pub fn handler(ctx: Context<VaultUnpause>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    require!(vault.status == VaultStatus::Paused, PreventraError::VaultNotPaused);

    vault.status = VaultStatus::Active;

    msg!("Vault unpaused for agent {}", vault.agent_identity);

    Ok(())
}
