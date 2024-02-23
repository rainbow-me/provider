import { describe, it, expect } from 'vitest';
import { BigNumber } from '@ethersproject/bignumber';
import { toHex } from './hex';

describe('Utils hex', () => {
  it('converts a number to a hex string', () => {
    const numberInput = 123;
    const expectedHex = '0x7b';
    expect(toHex(numberInput)).toBe(expectedHex);
  });

  it('converts a string to a hex string', () => {
    const stringInput = '456';
    const expectedHex = '0x01c8';
    expect(toHex(stringInput)).toBe(expectedHex);
  });

  it('converts a BigNumber to a hex string', () => {
    const bigNumberInput = BigNumber.from(789);
    const expectedHex = '0x0315';
    expect(toHex(bigNumberInput)).toBe(expectedHex);
  });
});
