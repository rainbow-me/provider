import { describe, it, expect } from 'vitest';

import { ChainId } from '../references/chains';
import { deriveChainIdByHostname, getDappHost, isValidUrl } from './apps';

describe('Utils apps', () => {
  describe('isValidUrl', () => {
    it('returns true for a valid URL', () => {
      expect(isValidUrl('http://www.example.com')).toBe(true);
    });

    it('returns false for an invalid URL', () => {
      expect(isValidUrl('not-a-valid-url')).toBe(false);
    });
  });

  describe('getDappHost', () => {
    it('returns the host from a valid URL', () => {
      expect(getDappHost('http://www.example.com/path')).toBe('example.com');
    });

    it('returns an empty string for an invalid URL', () => {
      expect(getDappHost('not-a-valid-url')).toBe('');
    });

    it('returns an empty string when no URL is provided', () => {
      expect(getDappHost()).toBe('');
    });
  });

  describe('deriveChainIdByHostname', () => {
    it('returns the correct ChainId for known hostnames', () => {
      expect(deriveChainIdByHostname('etherscan.io')).toBe(ChainId.mainnet);
      expect(deriveChainIdByHostname('goerli.etherscan.io')).toBe(
        ChainId.goerli,
      );
    });

    it('returns the default ChainId for unknown hostnames', () => {
      expect(deriveChainIdByHostname('unknown.io')).toBe(ChainId.mainnet);
    });
  });
});
