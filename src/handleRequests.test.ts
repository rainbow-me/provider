import { describe, it, expect, vi } from 'vitest';
import { RpcResponse } from 'ox';
import { handleRequests } from './handleRequests';
import { createMockHandlerTransport } from './utils/tests';
import type { MethodHandlers } from './transports';

describe('handleRequests', () => {
  it('routes requests to method handlers', async () => {
    const transport = createMockHandlerTransport();

    const mockHandler = vi.fn().mockResolvedValue('0x1');
    const methods: MethodHandlers = {
      eth_chainId: mockHandler,
    };

    handleRequests({ transport, methods });

    const result = await transport.sendRequest('eth_chainId');

    expect(result).toBe('0x1');
    expect(mockHandler).toHaveBeenCalled();
  });

  it('throws MethodNotSupportedError for unknown methods', async () => {
    const transport = createMockHandlerTransport();

    const methods: MethodHandlers = {
      eth_chainId: vi.fn().mockResolvedValue('0x1'),
    };

    handleRequests({ transport, methods });

    await expect(transport.sendRequest('unknown_method')).rejects.toThrow(
      RpcResponse.MethodNotSupportedError,
    );
  });

  it('routes custom methods correctly', async () => {
    const transport = createMockHandlerTransport();

    const customHandler = vi.fn().mockResolvedValue({ custom: true });
    const methods: MethodHandlers = {
      custom: {
        rainbow_customMethod: customHandler,
      },
    };

    handleRequests({ transport, methods });

    const result = await transport.sendRequest('rainbow_customMethod', [
      'arg1',
    ]);

    expect(result).toEqual({ custom: true });
    expect(customHandler).toHaveBeenCalled();
  });

  it('passes request with meta to handler', async () => {
    const transport = createMockHandlerTransport({
      defaultMeta: {
        host: 'custom.host.com',
        origin: 'https://custom.host.com',
        tabId: 123,
      },
    });

    const mockHandler = vi.fn().mockResolvedValue([]);
    const methods: MethodHandlers = {
      eth_accounts: mockHandler,
    };

    handleRequests({ transport, methods });

    await transport.sendRequest('eth_accounts');

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'eth_accounts',
        meta: expect.objectContaining({
          host: 'custom.host.com',
          origin: 'https://custom.host.com',
          tabId: 123,
        }),
      }),
    );
  });

  describe('emit functions', () => {
    it('emit.connect pushes connect event', () => {
      const transport = createMockHandlerTransport();

      const { emit } = handleRequests({ transport, methods: {} });

      emit.connect('0x1');

      const events = transport.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'connect', chainId: '0x1' });
    });

    it('emit.disconnect pushes disconnect event', () => {
      const transport = createMockHandlerTransport();

      const { emit } = handleRequests({ transport, methods: {} });

      const error = { code: 4001, message: 'User rejected' };
      emit.disconnect(error);

      const events = transport.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'disconnect', error });
    });

    it('emit.chainChanged pushes chainChanged event', () => {
      const transport = createMockHandlerTransport();

      const { emit } = handleRequests({ transport, methods: {} });

      emit.chainChanged('0xa');

      const events = transport.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'chainChanged', chainId: '0xa' });
    });

    it('emit.accountsChanged pushes accountsChanged event', () => {
      const transport = createMockHandlerTransport();

      const { emit } = handleRequests({ transport, methods: {} });

      const accounts = ['0x1234567890123456789012345678901234567890'] as const;
      emit.accountsChanged(accounts);

      const events = transport.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'accountsChanged', accounts });
    });
  });

  describe('handler error propagation', () => {
    it('propagates errors from handlers', async () => {
      const transport = createMockHandlerTransport();

      const methods: MethodHandlers = {
        eth_sendTransaction: vi
          .fn()
          .mockRejectedValue(new RpcResponse.TransactionRejectedError()),
      };

      handleRequests({ transport, methods });

      await expect(
        transport.sendRequest('eth_sendTransaction'),
      ).rejects.toThrow(RpcResponse.TransactionRejectedError);
    });
  });
});
