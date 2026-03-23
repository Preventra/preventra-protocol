/// Preventra error code metadata.
interface ErrorInfo {
  code: number;
  name: string;
  message: string;
}

/// All Preventra error codes mapped by their numeric code.
/// Range 6000-6014 reserved for Phase 0.
const ERROR_MAP: Record<number, ErrorInfo> = {
  6000: { code: 6000, name: "NameTooLong", message: "Agent name exceeds maximum length of 32 characters" },
  6001: { code: 6001, name: "ModelTooLong", message: "Model identifier exceeds maximum length of 64 characters" },
  6002: { code: 6002, name: "TooManyCapabilities", message: "Capabilities list exceeds maximum of 8 entries" },
  6003: { code: 6003, name: "CapabilityTooLong", message: "Individual capability exceeds maximum length of 32 characters" },
  6004: { code: 6004, name: "BioTooLong", message: "Agent bio exceeds maximum length of 256 characters" },
  6005: { code: 6005, name: "IdentityVerificationFailed", message: "Identity verification failed: identity not found or not owned by signer" },
  6006: { code: 6006, name: "InvalidDepositAmount", message: "Deposit amount must be greater than zero" },
  6007: { code: 6007, name: "InvalidWithdrawAmount", message: "Withdrawal amount must be greater than zero" },
  6008: { code: 6008, name: "InsufficientBalance", message: "Insufficient vault balance for withdrawal" },
  6009: { code: 6009, name: "ReserveFloorBreach", message: "Withdrawal rejected: would breach reserve floor" },
  6010: { code: 6010, name: "DailyLimitExceeded", message: "Withdrawal rejected: daily spending limit exceeded" },
  6011: { code: 6011, name: "MultisigThresholdExceeded", message: "Withdrawal rejected: amount exceeds multisig threshold" },
  6012: { code: 6012, name: "VaultPaused", message: "Vault is paused: withdrawals blocked until owner unpauses" },
  6013: { code: 6013, name: "VaultNotPausable", message: "Vault cannot be paused from its current state" },
  6014: { code: 6014, name: "VaultNotPaused", message: "Vault is not paused, cannot unpause" },
};

/// Typed error thrown when a Preventra transaction fails with a known error code.
export class PreventraError extends Error {
  public readonly code: number;
  public readonly errorName: string;

  constructor(code: number, errorName: string, message: string) {
    super(`${message} (${code})`);
    this.name = "PreventraError";
    this.code = code;
    this.errorName = errorName;
  }
}

/// Parse an Anchor program error into a PreventraError with a human-readable message.
/// Returns the original error if it does not match a known Preventra error code.
export function parseTransactionError(err: unknown): PreventraError | Error {
  // Anchor AnchorError format: err.error.errorCode.number
  if (err && typeof err === "object") {
    const maybeAnchor = err as Record<string, unknown>;

    if (maybeAnchor.error && typeof maybeAnchor.error === "object") {
      const anchorErr = maybeAnchor.error as Record<string, unknown>;
      if (anchorErr.errorCode && typeof anchorErr.errorCode === "object") {
        const errorCode = anchorErr.errorCode as Record<string, unknown>;
        const code = errorCode.number;
        if (typeof code === "number") {
          const known = ERROR_MAP[code];
          if (known) {
            return new PreventraError(known.code, known.name, known.message);
          }
        }
      }
    }

    // ProgramError format: err.code
    if ("code" in maybeAnchor && typeof maybeAnchor.code === "number") {
      const known = ERROR_MAP[maybeAnchor.code];
      if (known) {
        return new PreventraError(known.code, known.name, known.message);
      }
    }
  }

  if (err instanceof Error) return err;
  return new Error(String(err));
}

/// Look up a human-readable message for a Preventra error code.
export function getErrorMessage(code: number): string | undefined {
  const info = ERROR_MAP[code];
  return info ? `${info.message} (${info.code})` : undefined;
}
