import { BigNumber } from '@ethersproject/bignumber';
import { toHex as viemToHex } from 'viem';
import { hexValue } from '@ethersproject/bytes';

export const toHex = (stringToConvert: string | number | BigNumber | bigint): string => {
  // Handle BigInt from Viem
  if (typeof stringToConvert === 'bigint') {
    return viemToHex(stringToConvert);
  }
  
  // Handle existing BigNumber/string/number types
  return hexValue(BigNumber.from(stringToConvert).toHexString());
};

// Helper function to convert BigInt to BigNumber for backward compatibility
export const bigIntToBigNumber = (value: bigint): BigNumber => {
  return BigNumber.from(value.toString());
};

// Helper function to convert BigNumber to BigInt for Viem compatibility
export const bigNumberToBigInt = (value: BigNumber): bigint => {
  return BigInt(value.toString());
};
