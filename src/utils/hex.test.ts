import { describe, it, expect } from 'vitest';
import { BigNumber } from '@ethersproject/bignumber';
import { bigIntToBigNumber, bigNumberToBigInt, toHex } from './hex';

describe('Utils hex', () => {
  it('converts a number to a hex string', () => {
    const numberInput = 123;
    const expectedHex = '0x7b';
    expect(toHex(numberInput)).toBe(expectedHex);
  });

  it('converts a string to a hex string', () => {
    const stringInput = '456';
    const expectedHex = '0x1c8';
    expect(toHex(stringInput)).toBe(expectedHex);
  });

  it('converts a BigNumber to a hex string', () => {
    const bigNumberInput = BigNumber.from(789);
    const expectedHex = '0x315';
    expect(toHex(bigNumberInput)).toBe(expectedHex);
  });

  it('converts a BigInt to a hex string', () => {
    const bigIntInput = 789n;
    const expectedHex = '0x315';
    expect(toHex(bigIntInput)).toBe(expectedHex);
  });

  it('converts a BigInt to a BigNumber', () => {
    const bigIntInput = 789n;
    const expectedBigNumber = BigNumber.from(789);
    expect(bigIntToBigNumber(bigIntInput)).toStrictEqual(expectedBigNumber);
  });

  it('converts a BigNumber to a BigInt', () => {
    const bigNumberInput = BigNumber.from(789);
    const expectedBigInt = 789n;
    expect(bigNumberToBigInt(bigNumberInput)).toBe(expectedBigInt);
  });
});
