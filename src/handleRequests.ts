import { RpcResponse, Address, Hex, RpcSchema } from 'ox';
import type {
  HandlerTransport,
  MethodHandlers,
  MethodHandler,
  DefaultSchema,
} from './transports';

export type EmitFunctions = {
  connect: (chainId: Hex.Hex) => void;
  disconnect: (error: { code: number; message: string }) => void;
  chainChanged: (chainId: Hex.Hex) => void;
  accountsChanged: (accounts: readonly Address.Address[]) => void;
};

/**
 * Sets up request handling on the backend.
 * Generic over RpcSchema for custom method type safety.
 *
 * @example
 * ```ts
 * // Standard usage (uses DefaultSchema)
 * const { emit } = handleRequests({
 *   transport,
 *   methods: {
 *     eth_chainId: async () => '0x1',
 *     eth_accounts: async () => ['0x...'],
 *   },
 * });
 *
 * // With custom schema
 * type MySchema = ExtendSchema<MyCustomMethods>;
 * handleRequests<MySchema>({
 *   transport,
 *   methods: {
 *     rainbow_getProfile: async (req) => ({ name: '...' }), // typed!
 *   },
 * });
 * ```
 */
export function handleRequests<
  schema extends RpcSchema.Generic = DefaultSchema,
>(config: {
  transport: HandlerTransport;
  methods: MethodHandlers<schema>;
}): { emit: EmitFunctions } {
  const { transport, methods } = config;

  transport.onRequest(async (request) => {
    // Check for known method (cast needed for dynamic string access)
    const knownMethods = methods as Record<string, MethodHandler | undefined>;
    const handler = knownMethods[request.method];
    if (handler && typeof handler === 'function') {
      return handler(request);
    }

    // Check for custom method
    const customHandler = methods.custom?.[request.method];
    if (customHandler) {
      return customHandler(request);
    }

    throw new RpcResponse.MethodNotSupportedError();
  });

  const emit: EmitFunctions = {
    connect: (chainId) => transport.pushEvent({ type: 'connect', chainId }),
    disconnect: (error) => transport.pushEvent({ type: 'disconnect', error }),
    chainChanged: (chainId) =>
      transport.pushEvent({ type: 'chainChanged', chainId }),
    accountsChanged: (accounts) =>
      transport.pushEvent({ type: 'accountsChanged', accounts }),
  };

  return { emit };
}
