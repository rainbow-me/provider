import { describe, it, expect, vi } from 'vitest';
import { createProvider } from './createProvider';
import { createMockProviderTransport } from './utils/tests';

describe('createProvider', () => {
  it('creates a provider with required properties', () => {
    const transport = createMockProviderTransport({
      mockResponses: {
        eth_requestAccounts: ['0x1234567890123456789012345678901234567890'],
      },
    });

    const provider = createProvider({ transport });

    expect(provider.isMetaMask).toBe(true);
    expect(provider.isRainbow).toBe(true);
    expect(provider.isReady).toBe(true);
    expect(provider.connected).toBe(false);
    expect(provider.networkVersion).toBe('1');
    expect(provider.chainId).toBeUndefined();
    expect(provider.selectedAddress).toBeUndefined();
  });

  it('forwards requests to transport', async () => {
    const mockAccounts = ['0x1234567890123456789012345678901234567890'];
    const transport = createMockProviderTransport({
      mockResponses: {
        eth_requestAccounts: mockAccounts,
        eth_chainId: '0x1',
      },
    });

    const provider = createProvider({ transport });

    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    expect(accounts).toEqual(mockAccounts);

    const chainId = await provider.request({ method: 'eth_chainId' });
    expect(chainId).toBe('0x1');
  });

  describe('event handling', () => {
    it('handles connect event', () => {
      const transport = createMockProviderTransport();
      const provider = createProvider({ transport });

      const connectHandler = vi.fn();
      provider.on('connect', connectHandler);

      transport.pushEvent({ type: 'connect', chainId: '0x1' });

      expect(provider.connected).toBe(true);
      expect(provider.chainId).toBe('0x1');
      expect(connectHandler).toHaveBeenCalledWith({ chainId: '0x1' });
    });

    it('handles disconnect event', () => {
      const transport = createMockProviderTransport();
      const provider = createProvider({ transport });

      // First connect
      transport.pushEvent({ type: 'connect', chainId: '0x1' });
      expect(provider.connected).toBe(true);

      const disconnectHandler = vi.fn();
      provider.on('disconnect', disconnectHandler);

      const error = { code: 4001, message: 'Disconnected' };
      transport.pushEvent({ type: 'disconnect', error });

      expect(provider.connected).toBe(false);
      // The provider transforms the error to include ProviderRpcError fields
      expect(disconnectHandler).toHaveBeenCalledWith({
        ...error,
        name: 'ProviderRpcError',
        details: 'Disconnected',
      });
    });

    it('handles chainChanged event', () => {
      const transport = createMockProviderTransport();
      const provider = createProvider({ transport });

      const chainChangedHandler = vi.fn();
      provider.on('chainChanged', chainChangedHandler);

      transport.pushEvent({ type: 'chainChanged', chainId: '0xa' });

      expect(provider.chainId).toBe('0xa');
      expect(provider.networkVersion).toBe('10');
      expect(chainChangedHandler).toHaveBeenCalledWith('0xa');
    });

    it('handles accountsChanged event', () => {
      const transport = createMockProviderTransport();
      const provider = createProvider({ transport });

      const accountsChangedHandler = vi.fn();
      provider.on('accountsChanged', accountsChangedHandler);

      const accounts = ['0x1234567890123456789012345678901234567890'] as const;
      transport.pushEvent({ type: 'accountsChanged', accounts });

      expect(provider.selectedAddress).toBe(accounts[0]);
      expect(accountsChangedHandler).toHaveBeenCalledWith(accounts);
    });
  });

  describe('legacy methods', () => {
    it('enable() calls eth_requestAccounts', async () => {
      const mockAccounts = ['0x1234567890123456789012345678901234567890'];
      const transport = createMockProviderTransport({
        mockResponses: {
          eth_requestAccounts: mockAccounts,
        },
      });

      const provider = createProvider({ transport });
      const accounts = await provider.enable();

      expect(accounts).toEqual(mockAccounts);
    });

    it('isConnected() returns connection state', () => {
      const transport = createMockProviderTransport();
      const provider = createProvider({ transport });

      expect(provider.isConnected()).toBe(false);

      transport.pushEvent({ type: 'connect', chainId: '0x1' });

      expect(provider.isConnected()).toBe(true);
    });

    it('send() with string method works', async () => {
      const transport = createMockProviderTransport({
        mockResponses: {
          eth_chainId: '0x1',
        },
      });

      const provider = createProvider({ transport });
      const result = await provider.send('eth_chainId', []);

      expect(result).toBe('0x1');
    });

    it('send() with object payload works', async () => {
      const transport = createMockProviderTransport({
        mockResponses: {
          eth_chainId: '0x1',
        },
      });

      const provider = createProvider({ transport });
      const result = await provider.send({ method: 'eth_chainId' }, undefined);

      expect(result).toBe('0x1');
    });

    it('sendAsync() calls callback with result', async () => {
      const transport = createMockProviderTransport({
        mockResponses: {
          eth_chainId: '0x1',
        },
      });

      const provider = createProvider({ transport });

      const callback = vi.fn();
      provider.sendAsync({ id: 1, method: 'eth_chainId' }, callback);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledWith(null, {
        id: 1,
        jsonrpc: '2.0',
        result: '0x1',
      });
    });

    it('sendAsync() calls callback with error', async () => {
      const transport = createMockProviderTransport({
        mockResponses: {},
      });

      const provider = createProvider({ transport });

      const callback = vi.fn();
      provider.sendAsync({ id: 1, method: 'unknown_method' }, callback);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalled();
      const [error, response] = callback.mock.calls[0];
      expect(error).toBeTruthy();
      expect(response.id).toBe(1);
      expect(response.jsonrpc).toBe('2.0');
    });
  });
});
