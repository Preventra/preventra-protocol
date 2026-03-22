use anchor_lang::prelude::*;
use crate::state::ProvenanceRecord;

/// Update an agent's build provenance record.
///
/// Owner only. Records the new model and build hash, increments
/// the change counter, and updates the model_changed flag by
/// comparing the new hash against the initial_build_hash.
///
/// The A > B > C > A scenario: if an agent changes its model 3 times
/// and returns to the original, model_changed resets to false but
/// change_count stays at 3. The count is the audit trail.
#[derive(Accounts)]
pub struct UpdateProvenance<'info> {
    /// The provenance record to update. Owner constraint enforced by has_one.
    #[account(
        mut,
        seeds = [b"provenance", provenance.agent_identity.as_ref()],
        bump = provenance.bump,
        has_one = owner,
    )]
    pub provenance: Account<'info, ProvenanceRecord>,

    /// The provenance record owner. Must match provenance.owner.
    pub owner: Signer<'info>,
}

/// Apply provenance update: new model, new build hash, increment change count.
pub fn handler(
    ctx: Context<UpdateProvenance>,
    new_model: String,
    new_build_hash: [u8; 32],
) -> Result<()> {
    let provenance = &mut ctx.accounts.provenance;
    let clock = Clock::get()?;

    provenance.model = new_model;
    provenance.build_hash = new_build_hash;
    provenance.model_changed = new_build_hash != provenance.initial_build_hash;
    provenance.change_count = provenance.change_count.saturating_add(1);
    provenance.last_verified = clock.unix_timestamp;

    msg!(
        "Provenance updated for agent {}: changed={}, count={}",
        provenance.agent_identity,
        provenance.model_changed,
        provenance.change_count
    );

    Ok(())
}
