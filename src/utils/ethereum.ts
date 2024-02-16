import { TransactionResponse } from '@ethersproject/abstract-provider';

export const normalizeTransactionResponsePayload = (
  payload: TransactionResponse,
): TransactionResponse => {
  // Firefox can't serialize functions
  if (navigator.userAgent.toLowerCase().includes('firefox')) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return omit(payload, 'wait') as TransactionResponse;
  }
  return payload;
};
