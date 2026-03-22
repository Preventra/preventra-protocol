use anchor_lang::prelude::*;
use crate::errors::PreventraError;
use crate::state::{VaultAccount, VaultStatus, ProvenanceRecord};

/// Maximum agent name length in bytes.
const MAX_NAME_LENGTH: usize = 32;
/// Maximum model identifier length in bytes.
const MAX_MODEL_LENGTH: usize = 64;
/// Maximum number of capability entries.
const MAX_CAPABILITIES: usize = 8;
/// Maximum length of a single capability string in bytes.
const MAX_CAPABILITY_LENGTH: usize = 32;
/// Maximum agent bio length in bytes.
const MAX_BIO_LENGTH: usize = 256;

/// Register a new agent with vault governance and build provenance.
///
/// Phase 0 (mock identity): agent_identity is the Pubkey of a Keypair
/// generated client-side. No external identity verification.
///
/// Step 5 (QuantuLabs integration): agent_identity will be a QuantuLabs
/// 8004 asset Pubkey. The instruction will verify ownership by reading
/// the QuantuLabs AgentAccount PDA on-chain.
#[derive(Accounts)]
pub struct Register<'info> {
    /// The vault account, derived from agent_identity.
    /// Holds treasury governance state for this agent.
    #[account(
        init,
        payer = owner,
        space = 8 + VaultAccount::INIT_SPACE,
        seeds = [b"vault", agent_identity.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, VaultAccount>,

    /// The provenance record, derived from agent_identity.
    /// Tracks build hash and model change history.
    #[account(
        init,
        payer = owner,
        space = 8 + ProvenanceRecord::INIT_SPACE,
        seeds = [b"provenance", agent_identity.key().as_ref()],
        bump,
    )]
    pub provenance: Account<'info, ProvenanceRecord>,

    /// The agent identity key. Phase 0: any valid Pubkey passed as a Signer
    /// to prove the caller controls this identity. Step 5: QuantuLabs asset Pubkey
    /// verified via on-chain AgentAccount read.
    pub agent_identity: Signer<'info>,

    /// The wallet registering and owning this agent. Pays for account creation.
    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Validate registration inputs and initialize vault + provenance accounts.
#[allow(clippy::too_many_arguments)]
pub fn handler(
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
    // --- Input validation ---
    require!(name.len() <= MAX_NAME_LENGTH, PreventraError::NameTooLong);
    require!(model.len() <= MAX_MODEL_LENGTH, PreventraError::ModelTooLong);
    require!(capabilities.len() <= MAX_CAPABILITIES, PreventraError::TooManyCapabilities);
    for cap in &capabilities {
        require!(cap.len() <= MAX_CAPABILITY_LENGTH, PreventraError::CapabilityTooLong);
    }
    require!(bio.len() <= MAX_BIO_LENGTH, PreventraError::BioTooLong);

    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    // --- Initialize VaultAccount ---
    let vault = &mut ctx.accounts.vault;
    vault.bump = ctx.bumps.vault;
    vault.agent_identity = ctx.accounts.agent_identity.key();
    vault.owner = ctx.accounts.owner.key();
    vault.balance = 0;
    vault.total_deposited = 0;
    vault.total_withdrawn = 0;
    vault.daily_spend_limit = daily_spend_limit;
    vault.daily_spent = 0;
    vault.last_spend_reset = now;
    vault.reserve_floor = reserve_floor;
    vault.multisig_threshold = multisig_threshold;
    vault.status = VaultStatus::Active;
    vault.created_at = now;
    vault.reserved = vec![];

    // --- Initialize ProvenanceRecord ---
    let provenance = &mut ctx.accounts.provenance;
    provenance.bump = ctx.bumps.provenance;
    provenance.agent_identity = ctx.accounts.agent_identity.key();
    provenance.owner = ctx.accounts.owner.key();
    provenance.model = model;
    provenance.build_hash = build_hash;
    provenance.initial_build_hash = build_hash;
    provenance.model_changed = false;
    provenance.change_count = 0;
    provenance.last_verified = now;
    provenance.created_at = now;
    provenance.reserved = vec![];

    msg!(
        "Agent registered: identity={}, owner={}, name={}",
        ctx.accounts.agent_identity.key(),
        ctx.accounts.owner.key(),
        name
    );

    Ok(())
}
