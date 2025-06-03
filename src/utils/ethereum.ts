import type { GetTransactionReturnType } from 'viem';
import { bigIntToBigNumber } from './hex';
import { TransactionResponse } from '@ethersproject/abstract-provider';


export const normalizeTransactionResponsePayload = (
  payload: GetTransactionReturnType,
): TransactionResponse => {
  // Firefox can't serialize functions
  if (navigator.userAgent?.toLowerCase().includes('firefox')) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { wait: _, ...cleanedPayload } = viemTransactionToEthersResponse(payload);
    return cleanedPayload as TransactionResponse;
  }
  return viemTransactionToEthersResponse(payload);
};

// Convert Viem transaction to our ViemTransactionResponse
export const viemTransactionToEthersResponse = (
  viemTx: GetTransactionReturnType
): TransactionResponse => {
  return {
    hash: viemTx.hash,
    blockHash: viemTx.blockHash || undefined,
    blockNumber: viemTx.blockNumber ? Number(viemTx.blockNumber) : undefined,
    confirmations: 0, // Will be populated by provider if needed
    from: viemTx.from,
    gasPrice: viemTx.gasPrice ? bigIntToBigNumber(viemTx.gasPrice) : undefined,
    maxFeePerGas: viemTx.maxFeePerGas ? bigIntToBigNumber(viemTx.maxFeePerGas) : undefined,
    maxPriorityFeePerGas: viemTx.maxPriorityFeePerGas ? bigIntToBigNumber(viemTx.maxPriorityFeePerGas) : undefined,
    gasLimit: bigIntToBigNumber(viemTx.gas),
    to: viemTx.to || undefined,
    value: bigIntToBigNumber(viemTx.value),
    nonce: Number(viemTx.nonce),
    data: viemTx.input,
    r: viemTx.r || undefined,
    s: viemTx.s || undefined,
    v: viemTx.v ? Number(viemTx.v) : undefined,
    chainId: viemTx.chainId ? Number(viemTx.chainId) : 0,
    type: viemTx.type === 'legacy' ? 0 : viemTx.type === 'eip2930' ? 1 : viemTx.type === 'eip1559' ? 2 : undefined,
    // Note: wait function will be handled in normalizeTransactionResponsePayload
    wait: async () => {
      throw new Error('Transaction wait not implemented for Viem transactions');
    },
  };
};
