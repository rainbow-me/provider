import { createProviderError } from '../error';
import { MAX_BATCH_ID_LENGTH } from '../references/ethereum';
import { isAddress } from 'viem';

export { MAX_BATCH_ID_LENGTH };

/** Valid batch id type (non-empty string within max length). */
export type BatchId = string;

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
