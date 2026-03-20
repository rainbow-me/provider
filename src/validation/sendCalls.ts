import type { Hex } from 'viem';

/** EIP-5792: Max batch id length (4096 bytes = 8194 chars with 0x prefix) */
const MAX_BATCH_ID_LENGTH = 8194;

/** Valid batch id type (non-empty string within max length). */
type BatchId = Hex | string;

/** Typeguard: returns true if id is a valid batch id. */
export const isBatchId = (id: unknown): id is BatchId =>
  getSendCallsIdValidationError(id) === null;

/** Returns validation error message if id is invalid, null otherwise. */
export const getSendCallsIdValidationError = (
  id: unknown,
): { message: string } | null => {
  if (typeof id !== 'string') return { message: 'Batch id must be a string' };
  if (id.length === 0) return { message: 'Batch id cannot be empty' };
  if (id.length > MAX_BATCH_ID_LENGTH)
    return {
      message: `Batch id exceeds maximum length of ${MAX_BATCH_ID_LENGTH} characters`,
    };
  return null;
};

