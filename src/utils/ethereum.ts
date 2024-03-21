import { TransactionResponse } from '@ethersproject/abstract-provider';

export const normalizeTransactionResponsePayload = (
  payload: TransactionResponse,
): TransactionResponse => {
  // Firefox can't serialize functions
  if (navigator.userAgent?.toLowerCase().includes('firefox')) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { wait: _, ...cleanedPayload } = payload;
    return cleanedPayload as TransactionResponse;
  }
  return payload;
};
