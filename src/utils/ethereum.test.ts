import { describe, it, expect, afterAll } from 'vitest';
import { TransactionLegacy } from 'viem';
import { normalizeTransactionResponsePayload } from './ethereum';

describe('Utils ethereum', () => {
  const mockTransactionResponse = {
    wait: async () => {
      return {} as TransactionLegacy;
    },
    hash: '0x',
    from: '0x',
    to: '0x',
    nonce: 0,
    gas: 20000n,
    input: '0x',
    value: 1000000000000n,
    chainId: 0,
    type: 'legacy' as const,
    typeHex: '0x0',
    blockHash: '0x',
    blockNumber: 0,
    transactionIndex: 0,
    gasPrice: 1000000000n,
    r: '0x',
    s: '0x',
    v: 0n,
  } as unknown as TransactionLegacy & {
    wait: () => Promise<TransactionLegacy>;
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
