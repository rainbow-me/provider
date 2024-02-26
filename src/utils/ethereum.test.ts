import { describe, it, expect, afterAll } from 'vitest';
import type {
  TransactionReceipt,
  TransactionResponse,
} from '@ethersproject/abstract-provider';
import { normalizeTransactionResponsePayload } from './ethereum';
import { BigNumber } from '@ethersproject/bignumber';

describe('Utils ethereum', () => {
  const mockTransactionResponse: TransactionResponse = {
    wait: async () => {
      return {} as TransactionReceipt;
    },
    hash: '',
    confirmations: 0,
    from: '',
    nonce: 0,
    gasLimit: BigNumber.from(20000),
    data: '',
    value: BigNumber.from(1000000000000),
    chainId: 0,
  };

  it('removes wait function on Firefox', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:104.0) Gecko/20100101 Firefox/104.0',
      writable: true,
    });

    const result = normalizeTransactionResponsePayload(mockTransactionResponse);
    expect(result).not.toHaveProperty('wait');
  });

  it('does not modify payload on non-Firefox browsers', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36',
      writable: true,
    });

    const result = normalizeTransactionResponsePayload(mockTransactionResponse);
    expect(result).toHaveProperty('wait');
  });

  afterAll(() => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: '',
      writable: true,
    });
  });
});
