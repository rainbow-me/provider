import { describe, it, expect } from 'vitest';
import {
  hexString,
  address,
  ethSendTransactionParams,
  walletAddEthereumChainParams,
  walletWatchAssetParams,
  walletSendCallsParams,
  providerEvent,
  connectEvent,
  disconnectEvent,
  chainChangedEvent,
  accountsChangedEvent,
} from './index';

describe('schemas', () => {
  describe('primitives', () => {
    describe('hexString', () => {
      it('accepts valid hex strings', () => {
        expect(hexString.safeParse('0x').success).toBe(true);
        expect(hexString.safeParse('0x1').success).toBe(true);
        expect(hexString.safeParse('0xdeadbeef').success).toBe(true);
        expect(hexString.safeParse('0xDEADBEEF').success).toBe(true);
      });

      it('rejects invalid hex strings', () => {
        expect(hexString.safeParse('').success).toBe(false);
        expect(hexString.safeParse('0x').success).toBe(true); // empty hex is valid
        expect(hexString.safeParse('deadbeef').success).toBe(false);
        expect(hexString.safeParse('0xghij').success).toBe(false);
      });
    });

    describe('address', () => {
      it('accepts valid addresses', () => {
        expect(
          address.safeParse('0x1234567890123456789012345678901234567890')
            .success,
        ).toBe(true);
        expect(
          address.safeParse('0xABCDEF1234567890123456789012345678901234')
            .success,
        ).toBe(true);
      });

      it('rejects invalid addresses', () => {
        expect(address.safeParse('0x1234').success).toBe(false);
        expect(
          address.safeParse(
            '0x12345678901234567890123456789012345678901234567890',
          ).success,
        ).toBe(false);
        expect(
          address.safeParse('1234567890123456789012345678901234567890').success,
        ).toBe(false);
      });
    });
  });

  describe('ethSendTransactionParams', () => {
    it('accepts valid transaction params', () => {
      const result = ethSendTransactionParams.safeParse({
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '0xde0b6b3a7640000',
        gas: '0x5208',
        data: '0x',
      });
      expect(result.success).toBe(true);
    });

    it('accepts minimal transaction params', () => {
      const result = ethSendTransactionParams.safeParse({
        from: '0x1234567890123456789012345678901234567890',
      });
      expect(result.success).toBe(true);
    });

    it('rejects transaction without from', () => {
      const result = ethSendTransactionParams.safeParse({
        to: '0x0987654321098765432109876543210987654321',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('walletAddEthereumChainParams', () => {
    it('accepts valid chain params', () => {
      const result = walletAddEthereumChainParams.safeParse({
        chainId: '0x89',
        chainName: 'Polygon',
        nativeCurrency: {
          name: 'MATIC',
          symbol: 'MATIC',
          decimals: 18,
        },
        rpcUrls: ['https://polygon-rpc.com'],
        blockExplorerUrls: ['https://polygonscan.com'],
      });
      expect(result.success).toBe(true);
    });

    it('rejects symbol > 6 chars', () => {
      const result = walletAddEthereumChainParams.safeParse({
        chainId: '0x89',
        chainName: 'Test',
        nativeCurrency: {
          name: 'Test Token',
          symbol: 'TOOLONG',
          decimals: 18,
        },
        rpcUrls: ['https://rpc.test.com'],
      });
      expect(result.success).toBe(false);
    });

    it('rejects decimals > 36', () => {
      const result = walletAddEthereumChainParams.safeParse({
        chainId: '0x89',
        chainName: 'Test',
        nativeCurrency: {
          name: 'Test Token',
          symbol: 'TEST',
          decimals: 37,
        },
        rpcUrls: ['https://rpc.test.com'],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('walletWatchAssetParams', () => {
    it('accepts valid ERC20 asset', () => {
      const result = walletWatchAssetParams.safeParse({
        type: 'ERC20',
        options: {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'TEST',
          decimals: 18,
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-ERC20 type', () => {
      const result = walletWatchAssetParams.safeParse({
        type: 'ERC721',
        options: {
          address: '0x1234567890123456789012345678901234567890',
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('walletSendCallsParams', () => {
    it('accepts valid send calls params', () => {
      const result = walletSendCallsParams.safeParse({
        version: '1.0',
        from: '0x1234567890123456789012345678901234567890',
        calls: [
          {
            to: '0x0987654321098765432109876543210987654321',
            data: '0x',
            value: '0x1',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty calls array', () => {
      const result = walletSendCallsParams.safeParse({
        version: '1.0',
        from: '0x1234567890123456789012345678901234567890',
        calls: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('providerEvent', () => {
    it('accepts connect event', () => {
      const result = connectEvent.safeParse({
        type: 'connect',
        chainId: '0x1',
      });
      expect(result.success).toBe(true);
    });

    it('accepts disconnect event', () => {
      const result = disconnectEvent.safeParse({
        type: 'disconnect',
        error: { code: 4001, message: 'User rejected' },
      });
      expect(result.success).toBe(true);
    });

    it('accepts chainChanged event', () => {
      const result = chainChangedEvent.safeParse({
        type: 'chainChanged',
        chainId: '0xa',
      });
      expect(result.success).toBe(true);
    });

    it('accepts accountsChanged event', () => {
      const result = accountsChangedEvent.safeParse({
        type: 'accountsChanged',
        accounts: ['0x1234567890123456789012345678901234567890'],
      });
      expect(result.success).toBe(true);
    });

    it('discriminates by type in union', () => {
      expect(
        providerEvent.safeParse({ type: 'connect', chainId: '0x1' }).success,
      ).toBe(true);
      expect(
        providerEvent.safeParse({
          type: 'disconnect',
          error: { code: 1, message: 'err' },
        }).success,
      ).toBe(true);
      expect(
        providerEvent.safeParse({ type: 'chainChanged', chainId: '0x1' })
          .success,
      ).toBe(true);
      expect(
        providerEvent.safeParse({ type: 'accountsChanged', accounts: [] })
          .success,
      ).toBe(true);
    });

    it('rejects unknown event type', () => {
      const result = providerEvent.safeParse({
        type: 'unknownEvent',
        data: 'test',
      });
      expect(result.success).toBe(false);
    });
  });
});
