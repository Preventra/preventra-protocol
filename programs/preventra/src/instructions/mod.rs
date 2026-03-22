pub mod register;
pub mod vault_deposit;
pub mod vault_withdraw;
pub mod vault_pause;
pub mod vault_unpause;
pub mod update_provenance;

// Glob re-exports required by Anchor's #[program] macro for generated client account types.
// Handler name collisions are harmless since lib.rs calls each handler via explicit module path.
#[allow(ambiguous_glob_reexports)]
pub use register::*;
pub use vault_deposit::*;
pub use vault_withdraw::*;
pub use vault_pause::*;
pub use vault_unpause::*;
pub use update_provenance::*;
