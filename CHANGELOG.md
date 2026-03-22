# Changelog

All notable changes to Preventra Protocol will be documented in this file.

## [Unreleased]

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
- TypeScript SDK scaffold
- QuantuLabs 8004-solana integration notes

## [0.1.0] - 2026-03-22

Initial release. Vault governance, build provenance, unified registration.
