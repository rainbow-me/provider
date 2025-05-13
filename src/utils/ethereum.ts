import { TransactionLegacy } from 'viem';

type TransactionWithWait = TransactionLegacy & {
  wait: () => Promise<TransactionLegacy>;
};

export const normalizeTransactionResponsePayload = (
  payload: TransactionWithWait,
): TransactionLegacy => {
  // Firefox can't serialize functions
  if (navigator.userAgent?.toLowerCase().includes('firefox')) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { wait: _, ...cleanedPayload } = payload;
    return cleanedPayload as TransactionLegacy;
  }
  return payload;
};
