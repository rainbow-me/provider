import { BigNumber } from '@ethersproject/bignumber';

export const toHex = (stringToConvert: string | number | BigNumber): string =>
  BigNumber.from(stringToConvert).toHexString();
