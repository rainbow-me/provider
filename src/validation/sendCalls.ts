import { createProviderError } from '../error';
import { isAddress, type Hex } from 'viem';

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

/**
 * Validates app-provided batch id for wallet_sendCalls.
 * Throws createProviderError('INVALID_PARAMS', ...) if invalid.
 * Use before calling wallet_sendCalls to fail fast with the same error shape as the provider.
 */
export const validateSendCallsId = (id: unknown): void => {
  const err = getSendCallsIdValidationError(id);
  if (err) throw createProviderError('INVALID_PARAMS', err.message);
};

/** Returns validation error message if from is invalid when provided, null otherwise. */
export const getSendCallsFromValidationError = (
  from: unknown,
): { message: string } | null => {
  if (from === undefined || from === null) return null;
  if (typeof from !== 'string') return { message: 'from must be a string' };
  if (!isAddress(from)) return { message: 'Invalid from address' };
  return null;
};

/**
 * Validates app-provided from for wallet_sendCalls.
 * Throws createProviderError('INVALID_PARAMS', ...) if invalid.
 */
export const validateSendCallsFrom = (from: unknown): void => {
  const err = getSendCallsFromValidationError(from);
  if (err) throw createProviderError('INVALID_PARAMS', err.message);
};
