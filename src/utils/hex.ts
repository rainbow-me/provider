import { BigNumber } from '@ethersproject/bignumber';

export const trimHex = (stringToTrim: string) => {
  if (stringToTrim === '0x0') return stringToTrim;
  return stringToTrim.replace(/^0x0+/, '0x');
};
export const toHex = (stringToConvert: string | number | BigNumber): string => {
  const hexString = BigNumber.from(stringToConvert).toHexString();
  return trimHex(hexString);
};
