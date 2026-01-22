import { describe, it, expect, vi } from 'vitest';
import { RpcSchema } from 'ox';
import {
  createSessionMethods,
  createRpcMethods,
  createLocalMethods,
} from './index';
import type {
  Session,
  WalletRequest,
  CallsStatus,
  DefaultSchema,
  WalletRequestMeta,
} from '../transports';

// Helper to create a properly typed mock request using DefaultSchema
function createMockRequest<
  M extends RpcSchema.ExtractMethodName<DefaultSchema>,
>(
  method: M,
  params?: RpcSchema.ExtractParams<DefaultSchema, M>,
  host = 'test.example.com',
): WalletRequest & {
  method: M;
  params: RpcSchema.ExtractParams<DefaultSchema, M>;
} {
  return {
    method,
    params,
    id: 1,
    jsonrpc: '2.0',
    _returnType: undefined as unknown,
    meta: {
      host,
      origin: `https://${host}`,
    } as WalletRequestMeta,
  } as WalletRequest & {
    method: M;
    params: RpcSchema.ExtractParams<DefaultSchema, M>;
  };
}

describe('createSessionMethods', () => {
  const mockSession: Session = {
    address: '0x1234567890123456789012345678901234567890',
    chainId: 1,
  };

  it('eth_chainId returns session chainId as hex', async () => {
    const getSession = vi.fn().mockReturnValue(mockSession);
    const methods = createSessionMethods({ getSession });

    const result = await methods.eth_chainId!(createMockRequest('eth_chainId'));

    expect(result).toBe('0x1');
    expect(getSession).toHaveBeenCalledWith({ host: 'test.example.com' });
  });

  it('eth_chainId returns 0x1 when no session', async () => {
    const getSession = vi.fn().mockReturnValue(null);
    const methods = createSessionMethods({ getSession });

    const result = await methods.eth_chainId!(createMockRequest('eth_chainId'));

    expect(result).toBe('0x1');
  });

  it('eth_accounts returns session address in array', async () => {
    const getSession = vi.fn().mockReturnValue(mockSession);
    const methods = createSessionMethods({ getSession });

    const result = await methods.eth_accounts!(
      createMockRequest('eth_accounts'),
    );

    expect(result).toEqual([mockSession.address]);
  });

  it('eth_accounts returns empty array when no session', async () => {
    const getSession = vi.fn().mockReturnValue(null);
    const methods = createSessionMethods({ getSession });

    const result = await methods.eth_accounts!(
      createMockRequest('eth_accounts'),
    );

    expect(result).toEqual([]);
  });

  it('eth_coinbase returns session address', async () => {
    const getSession = vi.fn().mockReturnValue(mockSession);
    const methods = createSessionMethods({ getSession });

    const result = await methods.eth_coinbase!(
      createMockRequest('eth_coinbase'),
    );

    expect(result).toBe(mockSession.address);
  });

  it('eth_coinbase returns null when no session', async () => {
    const getSession = vi.fn().mockReturnValue(null);
    const methods = createSessionMethods({ getSession });

    const result = await methods.eth_coinbase!(
      createMockRequest('eth_coinbase'),
    );

    expect(result).toBeNull();
  });
});

describe('createRpcMethods', () => {
  it('forwards eth_blockNumber to transport', async () => {
    const mockTransport = {
      request: vi.fn().mockResolvedValue('0x123'),
    };

    const methods = createRpcMethods({ transport: mockTransport });

    const request = createMockRequest('eth_blockNumber');
    const result = await methods.eth_blockNumber!(request);

    expect(result).toBe('0x123');
    expect(mockTransport.request).toHaveBeenCalledWith(request);
  });

  it('forwards eth_getBalance to transport', async () => {
    const mockTransport = {
      request: vi.fn().mockResolvedValue('0xde0b6b3a7640000'),
    };

    const methods = createRpcMethods({ transport: mockTransport });

    const request = createMockRequest('eth_getBalance', [
      '0x1234567890123456789012345678901234567890',
      'latest',
    ]);
    const result = await methods.eth_getBalance!(request);

    expect(result).toBe('0xde0b6b3a7640000');
    expect(mockTransport.request).toHaveBeenCalledWith(request);
  });

  it('forwards eth_call to transport', async () => {
    const mockTransport = {
      request: vi.fn().mockResolvedValue('0x'),
    };

    const methods = createRpcMethods({ transport: mockTransport });

    const request = createMockRequest('eth_call', [
      { to: '0x1234567890123456789012345678901234567890' },
      'latest',
      {},
    ]);
    const result = await methods.eth_call!(request);

    expect(result).toBe('0x');
    expect(mockTransport.request).toHaveBeenCalledWith(request);
  });
});

describe('createLocalMethods', () => {
  it('wallet_getPermissions returns permissions for host', async () => {
    const mockPermissions = [
      {
        caveats: [],
        date: Date.now(),
        id: '1',
        invoker: 'https://test.example.com' as const,
        parentCapability: 'eth_accounts',
      },
    ];

    const getPermissions = vi.fn().mockReturnValue(mockPermissions);
    const getCapabilities = vi.fn();
    const getCallsStatus = vi.fn();

    const methods = createLocalMethods({
      getPermissions,
      getCapabilities,
      getCallsStatus,
    });

    const result = await methods.wallet_getPermissions!(
      createMockRequest('wallet_getPermissions'),
    );

    expect(result).toEqual(mockPermissions);
    expect(getPermissions).toHaveBeenCalledWith('test.example.com');
  });

  it('wallet_getCapabilities returns capabilities', async () => {
    const mockCapabilities = {
      '0x1': {
        atomicBatch: { supported: true },
      },
    };

    const getPermissions = vi.fn();
    const getCapabilities = vi.fn().mockReturnValue(mockCapabilities);
    const getCallsStatus = vi.fn();

    const methods = createLocalMethods({
      getPermissions,
      getCapabilities,
      getCallsStatus,
    });

    const result = await methods.wallet_getCapabilities!(
      createMockRequest('wallet_getCapabilities'),
    );

    expect(result).toEqual(mockCapabilities);
    expect(getCapabilities).toHaveBeenCalled();
  });

  it('wallet_getCallsStatus returns status for batch', async () => {
    const mockStatus: CallsStatus = {
      status: 'CONFIRMED',
      receipts: [
        {
          logs: [],
          status: '0x1',
          blockHash: '0x123',
          blockNumber: '0x1',
          gasUsed: '0x5208',
          transactionHash: '0xabc',
        },
      ],
    };

    const getPermissions = vi.fn();
    const getCapabilities = vi.fn();
    const getCallsStatus = vi.fn().mockReturnValue(mockStatus);

    const methods = createLocalMethods({
      getPermissions,
      getCapabilities,
      getCallsStatus,
    });

    const result = await methods.wallet_getCallsStatus!(
      createMockRequest('wallet_getCallsStatus', ['batch-123']),
    );

    expect(result).toEqual(mockStatus);
    expect(getCallsStatus).toHaveBeenCalledWith('batch-123');
  });

  it('wallet_getCallsStatus throws for unknown batch', async () => {
    const getPermissions = vi.fn();
    const getCapabilities = vi.fn();
    const getCallsStatus = vi.fn().mockReturnValue(null);

    const methods = createLocalMethods({
      getPermissions,
      getCapabilities,
      getCallsStatus,
    });

    await expect(
      methods.wallet_getCallsStatus!(
        createMockRequest('wallet_getCallsStatus', ['unknown-batch']),
      ),
    ).rejects.toThrow();
  });
});
