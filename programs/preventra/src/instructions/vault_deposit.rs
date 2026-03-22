use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::errors::PreventraError;
use crate::state::VaultAccount;

/// Deposit SOL into an agent's vault.
///
/// Permissionless: anyone can deposit. Works regardless of vault status
/// (Active or Paused) because accepting funds should never be blocked.
#[derive(Accounts)]
pub struct VaultDeposit<'info> {
    /// The vault to deposit into. Must match the agent_identity PDA.
    #[account(
        mut,
        seeds = [b"vault", vault.agent_identity.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, VaultAccount>,

    /// The depositor. Anyone can fund an agent's vault.
    #[account(mut)]
    pub depositor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Transfer SOL from depositor to vault PDA and update accounting.
pub fn handler(ctx: Context<VaultDeposit>, amount: u64) -> Result<()> {
    require!(amount > 0, PreventraError::InvalidDepositAmount);

    // Transfer SOL from depositor to vault PDA
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.depositor.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        amount,
    )?;

    let vault = &mut ctx.accounts.vault;
    vault.balance = vault.balance.checked_add(amount)
        .ok_or(PreventraError::InvalidDepositAmount)?;
    vault.total_deposited = vault.total_deposited.checked_add(amount)
        .ok_or(PreventraError::InvalidDepositAmount)?;

    msg!(
        "Vault deposit: {} lamports into vault for agent {}",
        amount,
        vault.agent_identity
    );

    Ok(())
}
