import { Address } from '../references';
import { ChainId } from './chains';

export type ActiveSession = { address: Address; chainId: number } | null;

export const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
};

export const getDappHost = (url?: string) => {
  try {
    if (url) {
      const host = new URL(url).host;
      if (host.indexOf('www.') === 0) {
        return host.replace('www.', '');
      }
      return host;
    }
    return '';
  } catch (e) {
    return '';
  }
};

export const deriveChainIdByHostname = (hostname: string) => {
  switch (hostname) {
    case 'etherscan.io':
      return ChainId.mainnet;
    case 'goerli.etherscan.io':
      return ChainId.goerli;
    case 'arbiscan.io':
      return ChainId.arbitrum;
    case 'explorer-mumbai.maticvigil.com':
    case 'explorer-mumbai.matic.today':
    case 'mumbai.polygonscan.com':
      return ChainId.polygonMumbai;
    case 'polygonscan.com':
      return ChainId.polygon;
    case 'optimistic.etherscan.io':
      return ChainId.optimism;
    case 'bscscan.com':
      return ChainId.bsc;
    case 'ftmscan.com':
      return ChainId.fantom;
    case 'explorer.celo.org':
      return ChainId.celo;
    case 'explorer.harmony.one':
      return ChainId.harmonyOne;
    case 'explorer.avax.network':
    case 'subnets.avax.network':
    case 'snowtrace.io':
      return ChainId.avalanche;
    case 'moonscan.io':
      return ChainId.moonbeam;
    default:
      return ChainId.mainnet;
  }
};
