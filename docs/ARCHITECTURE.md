# Provider v2 Architecture

EIP-1193 provider on [Ox](https://oxlib.sh). Core dep: `ox`. Optional: `zod`.

## Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│  createProvider()   │ ←─────→ │   handleRequests()  │
│  (Injected)         │         │   (Handler)         │
│  • EIP-1193         │         │  • Routes methods   │
│  • Event emitter    │         │  • Emits events     │
└─────────────────────┘         └─────────────────────┘
         ↓                               ↓
   ProviderTransport             HandlerTransport
   • request()                   • onRequest()
   • onEvent()                   • pushEvent()
```

Platform implements transport for messaging (extension, RN bridge, etc).

---

## Exports

### `@rainbow-me/provider`

```ts
// Functions
createProvider<schema>({ transport }): RainbowProvider<schema>
handleRequests<schema>({ transport, methods }): { emit: EmitFunctions }

// Types
RainbowProvider<S>, ProviderTransport, HandlerTransport
TypedProviderTransport<S>, TypedRequestFn<S>, TypedMethodHandler<S,M>, TypedMethodHandlers<S>
ProviderEvent, ConnectEvent, DisconnectEvent, ChainChangedEvent, AccountsChangedEvent
WalletRequest, WalletRequestMeta, MethodHandler, MethodHandlers<S>
Session, WalletPermission, CallsStatus
RpcSchema, DefaultSchema, ExtendSchema<T>
```

### `@rainbow-me/provider/defaults`

```ts
createSessionMethods({ getSession }); // eth_chainId, eth_accounts, eth_coinbase
createRpcMethods({ transport }); // eth_blockNumber, eth_getBalance, eth_call, ...
createLocalMethods({ getPermissions, getCapabilities, getCallsStatus });
```

### `@rainbow-me/provider/schemas`

Zod schemas: `hexString`, `address`, `ethSendTransactionParams`, `walletAddEthereumChainParams`, `providerEvent`, etc.

---

## API

```ts
// Generic over RpcSchema for custom methods
function createProvider<schema = DefaultSchema>(config: {
  transport: ProviderTransport;
}): RainbowProvider<schema>;

function handleRequests<schema = DefaultSchema>(config: {
  transport: HandlerTransport;
  methods: MethodHandlers<schema>;
}): { emit: EmitFunctions };
```

**EmitFunctions:** `connect(chainId)`, `disconnect(error)`, `chainChanged(chainId)`, `accountsChanged(accounts)`

---

## Transport Interfaces

```ts
interface ProviderTransport {
  request(request: RpcRequest): Promise<unknown>;
  onEvent(handler: (event: ProviderEvent) => void): () => void;
}

interface HandlerTransport {
  onRequest(handler: (request: WalletRequest) => Promise<unknown>): () => void;
  pushEvent(event: ProviderEvent): void;
}
```

---

## Type Safety

**DefaultSchema:** Corrected `RpcSchema.Default` — `eth_coinbase` returns `Address | null`

**Typed wrappers:**

```ts
TypedRequestFn<S>; // Request with inferred return type
TypedMethodHandler<S, M>; // Handler with typed params/return
TypedMethodHandlers<S>; // Map of all handlers
```

**Custom schemas:**

```ts
type MyMethods = RpcSchema.From<{ Request: {...}; ReturnType: ... }>;
type MySchema = ExtendSchema<MyMethods>;
createProvider<MySchema>({ transport });
handleRequests<MySchema>({ transport, methods });
```

---

## Events (EIP-1193)

| Event             | Payload              |
| ----------------- | -------------------- |
| `connect`         | `{ chainId: Hex }`   |
| `disconnect`      | `ProviderRpcError`   |
| `chainChanged`    | `Hex`                |
| `accountsChanged` | `readonly Address[]` |

---

## Errors

```ts
import { RpcResponse } from 'ox';
throw new RpcResponse.MethodNotSupportedError(); // -32004
throw new RpcResponse.InvalidParamsError(); // -32602
throw new RpcResponse.LimitExceededError(); // -32005
```

---

## Platform Responsibilities

In handlers, NOT lib: rate limiting, validation, feature flags, chain support.

```ts
handleRequests({
  transport,
  methods: {
    eth_requestAccounts: async (req) => {
      if (rateLimiter.isLimited(req.meta.host)) throw new RpcResponse.LimitExceededError();
      return showConnectUI(req);
    },
    custom: {
      rainbow_foo: async (req) => { ... },
    },
  },
});
```

---

## EIP-6963

Use `mipd` directly:

```ts
import { announceProvider } from 'mipd';
announceProvider({
  info: { uuid, name: 'Rainbow', icon, rdns: 'me.rainbow' },
  provider,
});
```

---

## EIPs

| EIP      | Methods                                     |
| -------- | ------------------------------------------- |
| EIP-191  | `personal_sign`, `personal_ecRecover`       |
| EIP-695  | `eth_chainId`                               |
| EIP-712  | `eth_signTypedData*`                        |
| EIP-1102 | `eth_requestAccounts`                       |
| EIP-1193 | Provider interface, events                  |
| EIP-2255 | `wallet_*Permissions`                       |
| EIP-3085 | `wallet_addEthereumChain`                   |
| EIP-3326 | `wallet_switchEthereumChain`                |
| EIP-5792 | `wallet_sendCalls`, `wallet_getCallsStatus` |
| EIP-6963 | Multi-provider discovery                    |

---

## Design Decisions

| Concern       | Resolution                             |
| ------------- | -------------------------------------- |
| Dependencies  | Ox only (zod optional)                 |
| Unimplemented | METHOD_NOT_SUPPORTED (-32004)          |
| Events        | Handler pushes → transport → provider  |
| Validation    | Optional via schemas, platform decides |
| EIP-6963      | Use `mipd` directly                    |
| Type safety   | Full Ox RpcSchema generics             |
