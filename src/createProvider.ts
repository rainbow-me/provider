import { Address, Hex, Provider, RpcRequest, RpcSchema } from 'ox';
import type { ProviderTransport, DefaultSchema } from './transports';

/**
 * EIP-1193 provider with Rainbow compatibility flags.
 * Generic over RpcSchema for custom method type safety.
 */
export type RainbowProvider<schema extends RpcSchema.Generic = DefaultSchema> =
  Provider.Provider<{ schema: schema; includeEvents: true }> & {
    readonly isMetaMask: true;
    readonly isRainbow: true;
    readonly isReady: true;
    chainId: Hex.Hex | undefined;
    networkVersion: string;
    selectedAddress: Address.Address | undefined;
    connected: boolean;
    providers: undefined;
    enable: () => Promise<readonly Address.Address[]>;
    isConnected: () => boolean;
    sendAsync: (args: unknown, cb: unknown) => void;
    send: (methodOrPayload: unknown, params: unknown) => Promise<unknown>;
  };

/**
 * Creates an EIP-1193 compliant provider.
 * Generic over RpcSchema for custom method type safety.
 *
 * @example
 * ```ts
 * // Standard usage (uses DefaultSchema)
 * const provider = createProvider({ transport });
 * const chainId = await provider.request({ method: 'eth_chainId' }); // typed as Hex
 *
 * // With custom schema
 * type MySchema = ExtendSchema<MyCustomMethods>;
 * const provider = createProvider<MySchema>({ transport });
 * ```
 */
export function createProvider<
  schema extends RpcSchema.Generic = DefaultSchema,
>(config: { transport: ProviderTransport }): RainbowProvider<schema> {
  const { transport } = config;
  const emitter = Provider.createEmitter();
  const store = RpcRequest.createStore();

  // Cast through unknown since Object.assign adds the Rainbow-specific properties
  const provider = Provider.from({
    ...emitter,
    async request(args) {
      // Use store.prepare to add id and jsonrpc, then send via transport
      const prepared = store.prepare(
        args as never,
      ) as unknown as RpcRequest.RpcRequest;
      return transport.request(prepared);
    },
  }) as unknown as RainbowProvider<schema>;

  // Subscribe to events from handler
  transport.onEvent((event) => {
    switch (event.type) {
      case 'connect':
        provider.connected = true;
        provider.chainId = event.chainId;
        emitter.emit('connect', { chainId: event.chainId });
        break;
      case 'disconnect':
        provider.connected = false;
        // Create a ProviderRpcError-compatible object
        emitter.emit('disconnect', {
          ...event.error,
          name: 'ProviderRpcError',
          details: event.error.message,
        });
        break;
      case 'chainChanged':
        provider.chainId = event.chainId;
        provider.networkVersion = String(parseInt(event.chainId, 16));
        emitter.emit('chainChanged', event.chainId);
        break;
      case 'accountsChanged':
        provider.selectedAddress = event.accounts[0];
        emitter.emit('accountsChanged', event.accounts);
        break;
    }
  });

  // Mutable state + legacy compat
  // Note: Legacy methods use `as never` casts since they accept arbitrary method strings
  Object.assign(provider, {
    isMetaMask: true,
    isRainbow: true,
    isReady: true,
    chainId: undefined,
    networkVersion: '1',
    selectedAddress: undefined,
    connected: false,
    providers: undefined,
    enable: () => provider.request({ method: 'eth_requestAccounts' } as never),
    isConnected: () => provider.connected,
    sendAsync: (
      args: { id?: number; method: string; params?: unknown[] },
      cb: (error: unknown, response: unknown) => void,
    ) =>
      provider
        .request(args as never)
        .then((r) => cb(null, { id: args.id, jsonrpc: '2.0', result: r }))
        .catch((e) => cb(e, { id: args.id, jsonrpc: '2.0', error: e })),
    send: (
      methodOrPayload: string | { method: string; params?: unknown[] },
      params: unknown[],
    ) =>
      typeof methodOrPayload === 'string'
        ? provider.request({ method: methodOrPayload, params } as never)
        : provider.request(methodOrPayload as never),
  });

  return provider;
}
