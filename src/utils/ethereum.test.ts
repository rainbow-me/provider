import { describe, it, expect, afterAll } from 'vitest';
import { normalizeTransactionResponsePayload } from './ethereum';
import type { GetTransactionReturnType } from 'viem';

describe('Utils ethereum', () => {
  const mockTransactionResponse: GetTransactionReturnType = {
    hash: '0x123',
    blockHash: '0x123',
    blockNumber: 1000n,
    type: 'eip1559',
    typeHex: '0x02',
    yParity: 0,
    input: '0x123',
    r: '0x123',
    s: '0x123',
    v: 0n,
    accessList: [],
    maxFeePerGas: 1000000000000n,
    maxPriorityFeePerGas: 1000000000000n,
    transactionIndex: 0,
    from: '0x456',
    to: '0x789',
    value: 1000000000000n,
    gas: 20000n,
    nonce: 100,
    chainId: 1,
  }

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
