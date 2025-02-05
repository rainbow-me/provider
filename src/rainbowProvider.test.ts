import { describe, it, expect, beforeEach } from 'vitest';
import { RainbowProvider } from './RainbowProvider';
import { ChainIdHex } from './references/ethereum';

describe('RainbowProvider chainId handling', () => {
  let provider: RainbowProvider;

  beforeEach(() => {
    provider = new RainbowProvider({});
  });

  describe('initial state', () => {
    it('should initialize with undefined chainId', () => {
      expect(provider.chainId).toBeUndefined();
    });

    it('should not assume mainnet as default network', () => {
      expect(provider.networkVersion).toBe('1'); // This test should fail as we want to change this behavior
    });
  });

  describe('handleChainChanged', () => {
    it('should update chainId when chain changes', async () => {
      const newChainId: ChainIdHex = '0xa'; // Chain ID 10 (Optimism)
      await provider.handleChainChanged(newChainId);

      expect(provider.chainId).toBe(newChainId);
    });

    it('should update networkVersion to decimal format', async () => {
      const chainIdHex: ChainIdHex = '0xa'; // Chain ID 10 (Optimism)
      await provider.handleChainChanged(chainIdHex);

      expect(provider.networkVersion).toBe('10');
    });

    it('should emit chainChanged event with hex chainId', async () => {
      const newChainId: ChainIdHex = '0xa';
      let emittedChainId: string | undefined;

      provider.on('chainChanged', (chainId: string) => {
        emittedChainId = chainId;
      });

      await provider.handleChainChanged(newChainId);

      expect(emittedChainId).toBe('0xa');
    });
  });

  describe('edge cases', () => {
    it('should handle repeated chain changes', async () => {
      const chainId1: ChainIdHex = '0x1';
      const chainId2: ChainIdHex = '0x89'; // Polygon

      await provider.handleChainChanged(chainId1);
      expect(provider.chainId).toBe(chainId1);
      expect(provider.networkVersion).toBe('1');

      await provider.handleChainChanged(chainId2);
      expect(provider.chainId).toBe(chainId2);
      expect(provider.networkVersion).toBe('137');
    });

    it('should maintain hex format for chainId', async () => {
      const chainIdHex: ChainIdHex = '0x89';
      await provider.handleChainChanged(chainIdHex);

      // Ensure chainId is still in hex format
      expect(provider.chainId).toBe('0x89');
      expect(provider.chainId).not.toBe('137');
    });
  });
});
