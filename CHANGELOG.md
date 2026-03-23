# Changelog

All notable changes to Preventra Protocol will be documented in this file.

## [Unreleased]

### Added
- TypeScript SDK (`@preventra/sdk`) with Preventra class, PDA derivation, human-readable error parsing
- WHITEPAPER.md covering problem statement, architecture, and roadmap
- `scripts/deploy-devnet.sh` for automated devnet deployment
- `scripts/register-clawburt.ts` for registering Clawburt as Agent #1
- QuantuLabs identity helpers in SDK (`identity.ts`)

## [0.1.0-rc.1] - 2026-03-22

### Added
- Anchor project scaffold with program structure
- VaultAccount state with treasury governance (daily limits, reserve floor, multisig threshold, pause/unpause)
- ProvenanceRecord state with build hash tracking and model change detection
- Registration instruction creating vault + provenance from mock identity
- Vault deposit instruction (permissionless, works when paused)
- Vault withdraw instruction with full governance enforcement
- Vault pause/unpause instructions
- Provenance update instruction with change count tracking
- 15 test cases covering all instructions and error paths
- QuantuLabs 8004-solana integration notes

## [0.1.0] - 2026-03-22

Initial release. Vault governance, build provenance, unified registration.
