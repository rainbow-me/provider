/**
 * Integration tests simulating two processes:
 * - Provider side (content script / dapp)
 * - Handler side (background script / extension)
 */
import { describe, it, expect, vi } from 'vitest';
import { createProvider } from './createProvider';
import { handleRequests } from './handleRequests';
import { createSessionMethods } from './defaults';
import { createMockTransportPair } from './utils/tests';
import type {
  ProviderTransport,
  HandlerTransport,
  ProviderEvent,
  WalletRequest,
  Session,
} from './transports';
import { Address, Hex } from 'ox';

type MessageChannel = {
  providerTransport: ProviderTransport;
  handlerTransport: HandlerTransport;
};

describe('Integration: Two-Process Communication', () => {
  // Simulates message passing between content script and background script
  function createMessageChannel(): MessageChannel {
    const eventListeners = new Set<(event: ProviderEvent) => void>();
    let requestHandler: ((req: WalletRequest) => Promise<unknown>) | null =
      null;

    // Simulate async message passing (like postMessage)
    const providerTransport: ProviderTransport = {
      async request(request) {
        // Simulate network delay
        await new Promise((r) => setTimeout(r, 1));

        if (!requestHandler) {
          throw new Error('Handler not connected');
        }

        // Add metadata (normally done by content script)
        const walletRequest: WalletRequest = {
          ...request,
          meta: {
            host: 'dapp.example.com',
            origin: 'https://dapp.example.com',
            tabId: 123,
          },
        };

        return requestHandler(walletRequest);
      },
      onEvent(handler) {
        eventListeners.add(handler);
        return () => eventListeners.delete(handler);
      },
    };

    const handlerTransport: HandlerTransport = {
      onRequest(handler) {
        requestHandler = handler;
        return () => {
          requestHandler = null;
        };
      },
      pushEvent(event) {
        // Simulate async event propagation
        setTimeout(() => {
          eventListeners.forEach((listener) => listener(event));
        }, 1);
      },
    };

    return { providerTransport, handlerTransport };
  }

  describe('Basic Request/Response Flow', () => {
    it('handles eth_chainId request through transport', async () => {
      const { providerTransport, handlerTransport } = createMessageChannel();

      // === HANDLER SIDE (Background Script) ===
      handleRequests({
        transport: handlerTransport,
        methods: {
          eth_chainId: async () => '0x1' as Hex.Hex,
        },
      });

      // === PROVIDER SIDE (Content Script / Dapp) ===
      const provider = createProvider({ transport: providerTransport });

      // Make request
      const chainId = await provider.request({ method: 'eth_chainId' });
      expect(chainId).toBe('0x1');
    });

    it('handles eth_accounts with session state', async () => {
      const { providerTransport, handlerTransport } = createMessageChannel();

      // Simulated session storage
      const sessions = new Map<string, Session>();
      sessions.set('dapp.example.com', {
        address: '0x1234567890123456789012345678901234567890',
        chainId: 1,
      });

      // === HANDLER SIDE ===
      handleRequests({
        transport: handlerTransport,
        methods: {
          ...createSessionMethods({
            getSession: (meta) => sessions.get(meta.host) ?? null,
          }),
        },
      });

      // === PROVIDER SIDE ===
      const provider = createProvider({ transport: providerTransport });

      const accounts = await provider.request({ method: 'eth_accounts' });
      expect(accounts).toEqual(['0x1234567890123456789012345678901234567890']);

      const chainId = await provider.request({ method: 'eth_chainId' });
      expect(chainId).toBe('0x1');
    });

    it('handles eth_requestAccounts connection flow', async () => {
      const { providerTransport, handlerTransport } = createMessageChannel();

      const sessions = new Map<string, Session>();
      const mockConnectUI = vi
        .fn()
        .mockResolvedValue(['0xabcdef1234567890123456789012345678901234']);

      // === HANDLER SIDE ===
      const { emit } = handleRequests({
        transport: handlerTransport,
        methods: {
          ...createSessionMethods({
            getSession: (meta) => sessions.get(meta.host) ?? null,
          }),
          eth_requestAccounts: async (
            req: WalletRequest,
          ): Promise<readonly Address.Address[]> => {
            // Show connect UI
            const accounts = (await mockConnectUI(
              req.meta,
            )) as Address.Address[];

            // Store session
            sessions.set(req.meta.host, {
              address: accounts[0],
              chainId: 1,
            });

            // Emit connect event
            emit.connect('0x1');
            emit.accountsChanged(accounts);

            return accounts;
          },
        },
      });

      // === PROVIDER SIDE ===
      const provider = createProvider({ transport: providerTransport });

      const connectHandler = vi.fn();
      const accountsHandler = vi.fn();
      provider.on('connect', connectHandler);
      provider.on('accountsChanged', accountsHandler);

      // Initially not connected
      expect(provider.connected).toBe(false);
      expect(provider.selectedAddress).toBeUndefined();

      // Request accounts (triggers connect flow)
      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      });

      expect(accounts).toEqual(['0xabcdef1234567890123456789012345678901234']);
      expect(mockConnectUI).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'dapp.example.com',
          origin: 'https://dapp.example.com',
        }),
      );

      // Wait for async events
      await new Promise((r) => setTimeout(r, 10));

      expect(provider.connected).toBe(true);
      expect(provider.chainId).toBe('0x1');
      expect(provider.selectedAddress).toBe(
        '0xabcdef1234567890123456789012345678901234',
      );
      expect(connectHandler).toHaveBeenCalled();
      expect(accountsHandler).toHaveBeenCalled();
    });
  });

  describe('Event Propagation', () => {
    it('propagates chainChanged from handler to provider', async () => {
      const { providerTransport, handlerTransport } = createMessageChannel();

      // === HANDLER SIDE ===
      const { emit } = handleRequests({
        transport: handlerTransport,
        methods: {
          eth_chainId: async () => '0x1' as Hex.Hex,
        },
      });

      // === PROVIDER SIDE ===
      const provider = createProvider({ transport: providerTransport });

      const chainChangedHandler = vi.fn();
      provider.on('chainChanged', chainChangedHandler);

      // Handler emits chain change
      emit.chainChanged('0xa');

      await new Promise((r) => setTimeout(r, 10));

      expect(chainChangedHandler).toHaveBeenCalledWith('0xa');
      expect(provider.chainId).toBe('0xa');
      expect(provider.networkVersion).toBe('10');
    });

    it('propagates disconnect from handler to provider', async () => {
      const { providerTransport, handlerTransport } = createMessageChannel();

      const { emit } = handleRequests({
        transport: handlerTransport,
        methods: {},
      });

      const provider = createProvider({ transport: providerTransport });

      // First connect
      emit.connect('0x1');
      await new Promise((r) => setTimeout(r, 10));
      expect(provider.connected).toBe(true);

      const disconnectHandler = vi.fn();
      provider.on('disconnect', disconnectHandler);

      // Disconnect
      emit.disconnect({ code: 4900, message: 'Disconnected by user' });
      await new Promise((r) => setTimeout(r, 10));

      expect(provider.connected).toBe(false);
      expect(disconnectHandler).toHaveBeenCalled();
    });
  });

  describe('Full Wallet Simulation', () => {
    it('simulates a complete dapp interaction', async () => {
      const { providerTransport, handlerTransport } = createMessageChannel();

      // === WALLET STATE (Background) ===
      const walletState = {
        accounts: ['0x1111111111111111111111111111111111111111'] as const,
        chainId: 1,
        sessions: new Map<string, Session>(),
        pendingTxs: new Map<string, { hash: string; status: string }>(),
      };

      // === HANDLER SIDE ===
      const { emit } = handleRequests({
        transport: handlerTransport,
        methods: {
          ...createSessionMethods({
            getSession: (meta) => walletState.sessions.get(meta.host) ?? null,
          }),
          eth_requestAccounts: async (
            req: WalletRequest,
          ): Promise<readonly Address.Address[]> => {
            walletState.sessions.set(req.meta.host, {
              address: walletState.accounts[0],
              chainId: walletState.chainId,
            });
            emit.connect(`0x${walletState.chainId.toString(16)}` as Hex.Hex);
            emit.accountsChanged([...walletState.accounts]);
            return [...walletState.accounts];
          },
          eth_sendTransaction: async (): Promise<Hex.Hex> => {
            // Simulate transaction submission
            const hash =
              `0x${Math.random().toString(16).slice(2).padStart(64, '0')}` as Hex.Hex;
            walletState.pendingTxs.set(hash, {
              hash,
              status: 'pending',
            });

            return hash;
          },
          eth_getTransactionReceipt: async (req: WalletRequest) => {
            const hash = (req.params as [Hex.Hex] | undefined)?.[0];
            if (!hash) return null;

            const tx = walletState.pendingTxs.get(hash);
            if (!tx) return null;

            // Return a minimal receipt that satisfies the schema
            return {
              transactionHash: hash,
              blockHash: '0x0' as Hex.Hex,
              blockNumber: '0x100' as Hex.Hex,
              cumulativeGasUsed: '0x0' as Hex.Hex,
              effectiveGasPrice: '0x0' as Hex.Hex,
              from: walletState.accounts[0],
              gasUsed: '0x5208' as Hex.Hex,
              logs: [],
              logsBloom: '0x0' as Hex.Hex,
              status: '0x1' as const,
              to: '0x0000000000000000000000000000000000000000' as Hex.Hex,
              transactionIndex: '0x0' as Hex.Hex,
              type: '0x2' as const,
            };
          },
          wallet_switchEthereumChain: async (
            req: WalletRequest,
          ): Promise<null> => {
            const [{ chainId }] = (req.params as [{ chainId: Hex.Hex }]) ?? [
              { chainId: '0x1' as Hex.Hex },
            ];
            const newChainId = parseInt(chainId, 16);

            walletState.chainId = newChainId;

            // Update session
            const session = walletState.sessions.get(req.meta.host);
            if (session) {
              walletState.sessions.set(req.meta.host, {
                ...session,
                chainId: newChainId,
              });
            }

            emit.chainChanged(chainId);
            return null;
          },
          custom: {
            rainbow_getWalletInfo: async () => ({
              version: '2.0.0',
              name: 'Rainbow',
            }),
          },
        },
      });

      // === PROVIDER SIDE (Dapp) ===
      const provider = createProvider({ transport: providerTransport });

      // 1. Connect
      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      });
      expect(accounts).toHaveLength(1);

      await new Promise((r) => setTimeout(r, 10));
      expect(provider.connected).toBe(true);

      // 2. Get chain
      const chainId = await provider.request({ method: 'eth_chainId' });
      expect(chainId).toBe('0x1');

      // 3. Send transaction
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: accounts[0],
            to: '0x2222222222222222222222222222222222222222',
            value: '0xde0b6b3a7640000',
          },
        ],
      });
      expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);

      // 4. Get receipt
      const receipt = await provider.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      });
      expect(receipt).toMatchObject({
        transactionHash: txHash,
        status: '0x1',
      });

      // 5. Switch chain
      const chainChangedHandler = vi.fn();
      provider.on('chainChanged', chainChangedHandler);

      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xa' }],
      });

      await new Promise((r) => setTimeout(r, 10));
      expect(chainChangedHandler).toHaveBeenCalledWith('0xa');
      expect(provider.chainId).toBe('0xa');

      // 6. Custom method
      const walletInfo = await provider.request({
        method: 'rainbow_getWalletInfo',
      });
      expect(walletInfo).toEqual({ version: '2.0.0', name: 'Rainbow' });
    });
  });

  describe('Error Handling', () => {
    it('propagates RPC errors from handler to provider', async () => {
      const { providerTransport, handlerTransport } = createMessageChannel();

      handleRequests({
        transport: handlerTransport,
        methods: {
          eth_sendTransaction: async () => {
            const error = new Error('User rejected transaction') as Error & {
              code: number;
            };
            error.code = 4001;
            throw error;
          },
        },
      });

      const provider = createProvider({ transport: providerTransport });

      await expect(
        provider.request({
          method: 'eth_sendTransaction',
          params: [{ from: '0x...', to: '0x...' }],
        }),
      ).rejects.toThrow('User rejected transaction');
    });

    it('throws MethodNotSupported for unknown methods', async () => {
      const { providerTransport, handlerTransport } = createMessageChannel();

      handleRequests({
        transport: handlerTransport,
        methods: {},
      });

      const provider = createProvider({ transport: providerTransport });

      await expect(
        provider.request({ method: 'eth_unknownMethod' }),
      ).rejects.toThrow();
    });
  });

  describe('Legacy Compatibility', () => {
    it('supports legacy enable() method', async () => {
      const { providerTransport, handlerTransport } = createMessageChannel();

      handleRequests({
        transport: handlerTransport,
        methods: {
          eth_requestAccounts: async () =>
            ['0x1234567890123456789012345678901234567890'] as Address.Address[],
        },
      });

      const provider = createProvider({ transport: providerTransport });

      const accounts = await provider.enable();
      expect(accounts).toEqual(['0x1234567890123456789012345678901234567890']);
    });

    it('supports legacy sendAsync() method', async () => {
      const { providerTransport, handlerTransport } = createMessageChannel();

      handleRequests({
        transport: handlerTransport,
        methods: {
          eth_chainId: async () => '0x1' as Hex.Hex,
        },
      });

      const provider = createProvider({ transport: providerTransport });

      const result = await new Promise((resolve, reject) => {
        provider.sendAsync(
          { id: 1, method: 'eth_chainId' },
          (error: unknown, response: unknown) => {
            if (error) reject(error);
            else resolve(response);
          },
        );
      });

      expect(result).toMatchObject({
        id: 1,
        jsonrpc: '2.0',
        result: '0x1',
      });
    });

    it('supports legacy send() method', async () => {
      const { providerTransport, handlerTransport } = createMessageChannel();

      handleRequests({
        transport: handlerTransport,
        methods: {
          eth_chainId: async () => '0x1' as Hex.Hex,
        },
      });

      const provider = createProvider({ transport: providerTransport });

      // String method format
      const result1 = await provider.send('eth_chainId', []);
      expect(result1).toBe('0x1');

      // Object payload format
      const result2 = await provider.send({ method: 'eth_chainId' }, []);
      expect(result2).toBe('0x1');
    });
  });

  describe('Multiple Dapps (Sessions)', () => {
    it('isolates sessions per dapp', async () => {
      // Create two separate transports (two dapps)
      const channel1 = createMockTransportPair();
      const channel2 = createMockTransportPair();

      const sessions = new Map<string, Session>();

      // Single handler serves both
      const setupHandler = (transport: HandlerTransport, host: string) => {
        // Override the host in the transport pair
        const originalOnRequest = transport.onRequest.bind(transport);
        transport.onRequest = (handler) => {
          return originalOnRequest((request) => {
            return handler({
              ...request,
              meta: { ...request.meta, host, origin: `https://${host}` },
            });
          });
        };

        return handleRequests({
          transport,
          methods: {
            ...createSessionMethods({
              getSession: (meta) => sessions.get(meta.host) ?? null,
            }),
            eth_requestAccounts: async (
              req: WalletRequest,
            ): Promise<readonly Address.Address[]> => {
              const address =
                `0x${req.meta.host.split('.')[0].padEnd(40, '0').slice(0, 40)}` as Address.Address;
              sessions.set(req.meta.host, { address, chainId: 1 });
              return [address];
            },
          },
        });
      };

      setupHandler(channel1.handlerTransport, 'dapp1.com');
      setupHandler(channel2.handlerTransport, 'dapp2.com');

      const provider1 = createProvider({
        transport: channel1.providerTransport,
      });
      const provider2 = createProvider({
        transport: channel2.providerTransport,
      });

      // Connect both dapps
      const accounts1 = await provider1.request({
        method: 'eth_requestAccounts',
      });
      const accounts2 = await provider2.request({
        method: 'eth_requestAccounts',
      });

      // Each gets different address based on host
      expect(accounts1[0]).not.toBe(accounts2[0]);
      expect(accounts1[0]).toContain('dapp1');
      expect(accounts2[0]).toContain('dapp2');

      // Sessions are isolated
      expect(sessions.size).toBe(2);
      expect(sessions.get('dapp1.com')).toBeDefined();
      expect(sessions.get('dapp2.com')).toBeDefined();
    });
  });
});
