import { Address, Hex, RpcRequest, RpcSchema } from 'ox';

// Re-export RpcSchema for users to extend their schemas
export type { RpcSchema };

// ─── Corrected Schema ───────────────────────────────────────────────
// Ox schema has some incorrect types. We extend/override them here.

/**
 * Corrected eth_coinbase that allows null (per JSON-RPC spec).
 * Ox incorrectly expects only Address.Address.
 */
type CorrectedEthCoinbase = {
  Request: { method: 'eth_coinbase'; params?: undefined };
  ReturnType: Address.Address | null;
};

/**
 * Default schema with corrections for spec-compliant behavior.
 * Use this instead of RpcSchema.Default for accurate typing.
 */
export type DefaultSchema =
  | Exclude<RpcSchema.Default, { Request: { method: 'eth_coinbase' } }>
  | CorrectedEthCoinbase;

// ─── EIP-1193 Provider Events ───────────────────────────────────────
// Discriminated union using Ox primitives

export type ConnectEvent = {
  readonly type: 'connect';
  readonly chainId: Hex.Hex;
};

export type DisconnectEvent = {
  readonly type: 'disconnect';
  readonly error: { code: number; message: string };
};

export type ChainChangedEvent = {
  readonly type: 'chainChanged';
  readonly chainId: Hex.Hex;
};

export type AccountsChangedEvent = {
  readonly type: 'accountsChanged';
  readonly accounts: readonly Address.Address[];
};

export type ProviderEvent =
  | ConnectEvent
  | DisconnectEvent
  | ChainChangedEvent
  | AccountsChangedEvent;

// ─── Request Context (passed to handlers) ───────────────────────────
// Extends Ox RpcRequest with metadata for wallet handlers

export type WalletRequestMeta = {
  readonly host: string;
  readonly origin: string;
  readonly tabId?: number;
};

export type WalletRequest = RpcRequest.RpcRequest & {
  readonly meta: WalletRequestMeta;
};

// ─── Transport Interfaces ───────────────────────────────────────────
// Bidirectional: injected provider ↔ handler
// These are the base interfaces - see typed wrappers below for type safety

/** Injected side: sends requests, receives events */
export interface ProviderTransport {
  request(request: RpcRequest.RpcRequest): Promise<unknown>;
  onEvent(handler: (event: ProviderEvent) => void): () => void;
}

/** Handler side: receives requests, pushes events */
export interface HandlerTransport {
  onRequest(handler: (request: WalletRequest) => Promise<unknown>): () => void;
  pushEvent(event: ProviderEvent): void;
}

// ─── Type-Safe Transport Wrappers ───────────────────────────────────
// Generic wrappers that provide full request/response type matching

/**
 * Type-safe request function matching Ox's Provider.RequestFn.
 * Infers return type from the method name.
 *
 * @example
 * ```ts
 * const request: TypedRequestFn = transport.request as TypedRequestFn;
 *
 * // Return type is inferred as `0x${string}`
 * const chainId = await request({ method: 'eth_chainId' });
 *
 * // Return type is inferred as readonly Address[]
 * const accounts = await request({ method: 'eth_accounts' });
 * ```
 */
export type TypedRequestFn<schema extends RpcSchema.Generic = DefaultSchema> = <
  methodName extends RpcSchema.MethodNameGeneric<schema>,
>(args: {
  method: methodName;
  params?: RpcSchema.ExtractParams<schema, methodName>;
}) => Promise<RpcSchema.ExtractReturnType<schema, methodName>>;

/**
 * Type-safe provider transport with request/response type matching.
 * Use this wrapper type for full type safety in your application.
 *
 * @example
 * ```ts
 * function useProvider(transport: TypedProviderTransport) {
 *   // chainId is typed as `0x${string}`
 *   const chainId = await transport.request({ method: 'eth_chainId' });
 * }
 * ```
 */
export interface TypedProviderTransport<
  schema extends RpcSchema.Generic = DefaultSchema,
> {
  request: TypedRequestFn<schema>;
  onEvent(handler: (event: ProviderEvent) => void): () => void;
}

// ─── Method Handler Types ───────────────────────────────────────────

/**
 * Type-safe method handler for a specific RPC method.
 * Infers params and return type from the schema.
 *
 * @example
 * ```ts
 * const handler: TypedMethodHandler<RpcSchema.Default, 'eth_chainId'> = async (req) => {
 *   // req.params is typed correctly, return type must be Hex
 *   return '0x1';
 * };
 * ```
 */
export type TypedMethodHandler<
  schema extends RpcSchema.Generic,
  methodName extends RpcSchema.MethodNameGeneric<schema>,
> = (
  request: WalletRequest & {
    method: methodName;
    params?: RpcSchema.ExtractParams<schema, methodName>;
  },
) => Promise<RpcSchema.ExtractReturnType<schema, methodName>>;

/**
 * Generic method handler (for dynamic routing).
 */
export type MethodHandler = (request: WalletRequest) => Promise<unknown>;

/**
 * Type-safe method handlers map.
 * Each handler has correctly typed params and return type.
 *
 * @example
 * ```ts
 * const handlers: TypedMethodHandlers = {
 *   eth_chainId: async () => '0x1',
 *   eth_accounts: async () => ['0x...'],
 *   eth_sendTransaction: async (req) => {
 *     const [tx] = req.params!;
 *     return '0x...'; // transaction hash
 *   },
 * };
 * ```
 */
export type TypedMethodHandlers<
  schema extends RpcSchema.Generic = DefaultSchema,
> = {
  [K in RpcSchema.ExtractMethodName<schema>]?: TypedMethodHandler<schema, K>;
};

/**
 * Method handlers configuration with strict typing.
 * Each handler has typed params and return type from RpcSchema.
 */
export type MethodHandlers<schema extends RpcSchema.Generic = DefaultSchema> =
  TypedMethodHandlers<schema> & {
    // Custom methods (platform-specific, non-standard)
    custom?: Record<string, MethodHandler>;
  };

// ─── Session Type ───────────────────────────────────────────────────
export type Session = {
  readonly address: Address.Address;
  readonly chainId: number;
};

// ─── Permission Types (EIP-2255) ────────────────────────────────────
export type WalletPermissionCaveat = {
  readonly type: string;
  readonly value: unknown;
};

export type WalletPermission = {
  readonly caveats: readonly WalletPermissionCaveat[];
  readonly date: number;
  readonly id: string;
  readonly invoker: `http://${string}` | `https://${string}`;
  readonly parentCapability: 'eth_accounts' | string;
};

// ─── Calls Status Types (EIP-5792) ──────────────────────────────────
export type CallsStatus = {
  readonly status: 'PENDING' | 'CONFIRMED';
  readonly receipts?: readonly {
    readonly logs: readonly {
      readonly address: Address.Address;
      readonly data: Hex.Hex;
      readonly topics: readonly Hex.Hex[];
    }[];
    readonly status: Hex.Hex;
    readonly blockHash: Hex.Hex;
    readonly blockNumber: Hex.Hex;
    readonly gasUsed: Hex.Hex;
    readonly transactionHash: Hex.Hex;
  }[];
};

// ─── Helper Types for Custom Schemas ────────────────────────────────

/**
 * Create a custom RPC schema that extends the default.
 *
 * @example
 * ```ts
 * // Define custom methods
 * type RainbowMethods = RpcSchema.From<
 *   | {
 *       Request: { method: 'rainbow_getProfile'; params: [address: `0x${string}`] };
 *       ReturnType: { name: string; avatar: string };
 *     }
 *   | {
 *       Request: { method: 'rainbow_getTokens'; params?: undefined };
 *       ReturnType: Array<{ address: string; symbol: string }>;
 *     }
 * >;
 *
 * // Extend the default schema
 * type MySchema = ExtendSchema<RainbowMethods>;
 *
 * // Use with typed transport
 * const transport: TypedProviderTransport<MySchema> = ...;
 *
 * // Full type safety for custom methods
 * const profile = await transport.request({
 *   method: 'rainbow_getProfile',
 *   params: ['0x...'],
 * });
 * // profile is typed as { name: string; avatar: string }
 * ```
 */
export type ExtendSchema<custom extends RpcSchema.Generic> =
  | DefaultSchema
  | custom;
