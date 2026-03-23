#!/usr/bin/env bash
# Deploy Preventra Protocol to Solana devnet.
# Usage: ./scripts/deploy-devnet.sh
#
# Prerequisites:
#   - Solana CLI configured for devnet: solana config set --url devnet
#   - Funded devnet wallet: solana airdrop 5
#   - Anchor CLI installed
#   - Program built: anchor build

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Preventra Protocol Devnet Deployment ==="
echo ""

# Verify Solana CLI is configured for devnet
CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $NF}')
if [[ "$CLUSTER" != *"devnet"* ]]; then
  echo "ERROR: Solana CLI not configured for devnet."
  echo "Run: solana config set --url devnet"
  exit 1
fi

# Check wallet balance
BALANCE=$(solana balance | awk '{print $1}')
echo "Wallet balance: ${BALANCE} SOL"

# Need at least 3 SOL for deployment (program + buffer + rent)
MIN_BALANCE="3"
if (( $(echo "$BALANCE < $MIN_BALANCE" | bc -l) )); then
  echo "WARNING: Balance below ${MIN_BALANCE} SOL. Attempting airdrop..."
  solana airdrop 5 || {
    echo "Airdrop failed. Fund your wallet manually:"
    echo "  solana airdrop 2  (try smaller amounts)"
    echo "  Or use https://faucet.solana.com"
    exit 1
  }
  echo "New balance: $(solana balance)"
fi

# Build if needed
if [ ! -f "$PROJECT_ROOT/target/deploy/preventra.so" ]; then
  echo "Program binary not found. Building..."
  cd "$PROJECT_ROOT"
  anchor build
fi

echo ""
echo "Deploying to devnet..."
cd "$PROJECT_ROOT"
anchor deploy --provider.cluster devnet

echo ""
echo "=== Deployment Complete ==="

# Extract and display program ID
PROGRAM_ID=$(solana address -k target/deploy/preventra-keypair.json 2>/dev/null || echo "unknown")
echo "Program ID: $PROGRAM_ID"
echo "Explorer:   https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet"
echo ""
echo "Next step: Register Clawburt as Agent #1"
echo "  npx ts-node scripts/register-clawburt.ts"
