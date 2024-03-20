import { BigNumber } from '@ethersproject/bignumber';
import { hexValue } from '@ethersproject/bytes';

export const toHex = (stringToConvert: string | number | BigNumber): string => {
  return hexValue(BigNumber.from(stringToConvert).toHexString());
};
