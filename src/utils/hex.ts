import { BigNumber } from '@ethersproject/bignumber';

export const toHex = (stringToConvert: string): string =>
  BigNumber.from(stringToConvert).toHexString();
