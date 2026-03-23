import { PublicKey } from "@solana/web3.js";

/// QuantuLabs Agent Registry 8004 program IDs by cluster.
export const QUANTULABS_PROGRAM_IDS = {
  devnet: new PublicKey("8oo4J9tBB3Hna1jRQ3rWvJjojqM5DYTDJo5cejUuJy3C"),
  localnet: new PublicKey("8oo4dC4JvBLwy5tGgiH3WwK4B9PWxL9Z4XjA2jzkQMbQ"),
} as const;

/// Metaplex Core program ID (same on all clusters).
export const METAPLEX_CORE_PROGRAM_ID = new PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);

/// Derive the QuantuLabs AgentAccount PDA from an asset pubkey.
/// PDA seeds: ["agent", asset.key().as_ref()]
export function findQuantuLabsAgentPda(
  assetPubkey: PublicKey,
  cluster: "devnet" | "localnet" = "devnet"
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), assetPubkey.toBuffer()],
    QUANTULABS_PROGRAM_IDS[cluster]
  );
}

/// Derive the QuantuLabs RootConfig PDA.
/// PDA seeds: ["root_config"]
export function findQuantuLabsRootConfigPda(
  cluster: "devnet" | "localnet" = "devnet"
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("root_config")],
    QUANTULABS_PROGRAM_IDS[cluster]
  );
}

/// Derive the QuantuLabs RegistryConfig PDA from a collection pubkey.
/// PDA seeds: ["registry_config", collection.key().as_ref()]
export function findQuantuLabsRegistryConfigPda(
  collectionPubkey: PublicKey,
  cluster: "devnet" | "localnet" = "devnet"
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("registry_config"), collectionPubkey.toBuffer()],
    QUANTULABS_PROGRAM_IDS[cluster]
  );
}
