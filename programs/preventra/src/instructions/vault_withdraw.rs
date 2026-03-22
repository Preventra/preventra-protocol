use anchor_lang::prelude::*;
use crate::errors::PreventraError;
use crate::state::{VaultAccount, VaultStatus};

/// Seconds in one day, used for daily spend limit reset.
const SECONDS_PER_DAY: i64 = 86_400;

/// Withdraw SOL from an agent's vault.
///
/// Owner only. Enforces all governance constraints:
/// - Vault must be Active (not Paused)
/// - Amount must be greater than zero
/// - Balance after withdrawal must remain above reserve floor
/// - Daily spending limit enforced with 24-hour rolling window
/// - Single withdrawal must be below multisig threshold
#[derive(Accounts)]
pub struct VaultWithdraw<'info> {
    /// The vault to withdraw from. Owner constraint enforced by has_one.
    #[account(
        mut,
        seeds = [b"vault", vault.agent_identity.as_ref()],
        bump = vault.bump,
        has_one = owner,
    )]
    pub vault: Account<'info, VaultAccount>,

    /// The vault owner. Must match vault.owner.
    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Validate governance constraints and transfer SOL from vault PDA to owner.
pub fn handler(ctx: Context<VaultWithdraw>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    // Status check: must be Active
    require!(vault.status == VaultStatus::Active, PreventraError::VaultPaused);

    // Amount validation
    require!(amount > 0, PreventraError::InvalidWithdrawAmount);

    // Multisig threshold: reject single withdrawals above threshold
    require!(amount <= vault.multisig_threshold, PreventraError::MultisigThresholdExceeded);

    // Reserve floor: balance after withdrawal must stay above floor
    let balance_after = vault.balance.checked_sub(amount)
        .ok_or(PreventraError::InsufficientBalance)?;
    require!(balance_after >= vault.reserve_floor, PreventraError::ReserveFloorBreach);

    // Daily limit reset: if >= 24 hours have passed, reset the window
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    if now - vault.last_spend_reset >= SECONDS_PER_DAY {
        vault.daily_spent = 0;
        vault.last_spend_reset = now;
    }

    // Daily limit check: amount + already spent must not exceed limit
    let new_daily_spent = vault.daily_spent.checked_add(amount)
        .ok_or(PreventraError::DailyLimitExceeded)?;
    require!(new_daily_spent <= vault.daily_spend_limit, PreventraError::DailyLimitExceeded);

    // All checks passed. Transfer SOL from vault PDA to owner.
    // Vault is a PDA, so we debit its lamports directly.
    vault.sub_lamports(amount)?;
    ctx.accounts.owner.add_lamports(amount)?;

    // Update accounting
    vault.balance = balance_after;
    vault.daily_spent = new_daily_spent;
    vault.total_withdrawn = vault.total_withdrawn.checked_add(amount)
        .ok_or(PreventraError::InvalidWithdrawAmount)?;

    msg!(
        "Vault withdrawal: {} lamports from agent {} to owner {}",
        amount,
        vault.agent_identity,
        ctx.accounts.owner.key()
    );

    Ok(())
}
