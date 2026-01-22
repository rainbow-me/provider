# Migration: v1 → v2

## Overview

v2 rewrites with Ox. Removes `@ethersproject/*`, `viem`, `eventemitter3`, `@metamask/eth-sig-util`.

| v1                                        | v2                                       |
| ----------------------------------------- | ---------------------------------------- |
| `new RainbowProvider(config)`             | `createProvider({ transport })`          |
| `handleProviderRequest({ ... })`          | `handleRequests({ transport, methods })` |
| `eventemitter3`                           | Ox internal                              |
| `@ethersproject/providers`                | `Ox.RpcTransport`                        |
| `viem` types                              | `Ox` types                               |
| `@metamask/eth-sig-util`                  | `Ox.PersonalMessage`, `Ox.Secp256k1`     |
| `IMessenger`, `IProviderRequestTransport` | `ProviderTransport`, `HandlerTransport`  |

---

## Steps

### 1. Dependencies

```bash
yarn remove @ethersproject/providers viem @metamask/eth-sig-util eventemitter3
yarn add ox
```

### 2. Provider

**Before:**

```ts
const provider = new RainbowProvider({
  backgroundMessenger,
  providerRequestTransport,
  onConstruct: ({ emit }) => { ... },
});
```

**After:**

```ts
const transport: ProviderTransport = {
  request: (req) => messenger.send(req),
  onEvent: (handler) => messenger.subscribe('providerEvent', handler),
};
const provider = createProvider({ transport });
```

### 3. Handler

**Before:**

```ts
handleProviderRequest({
  providerRequestTransport,
  getFeatureFlags, checkRateLimit, isSupportedChain,
  getActiveSession, getProvider, messengerProviderRequest,
  onAddEthereumChain, onSwitchEthereumChainSupported, ...
});
```

**After:**

```ts
import { handleRequests } from '@rainbow-me/provider';
import {
  createSessionMethods,
  createRpcMethods,
  createLocalMethods,
} from '@rainbow-me/provider/defaults';
import { RpcTransport, RpcResponse } from 'ox';

const transport: HandlerTransport = {
  onRequest: (handler) =>
    messenger.subscribe('providerRequest', (req) =>
      handler({
        ...req,
        meta: { host: getDappHost(req.origin), origin: req.origin },
      }),
    ),
  pushEvent: (event) => messenger.broadcast('providerEvent', event),
};

const { emit } = handleRequests({
  transport,
  methods: {
    ...createSessionMethods({
      getSession: (meta) => sessionStore.get(meta.host),
    }),
    ...createRpcMethods({ transport: RpcTransport.fromHttp('https://...') }),
    ...createLocalMethods({ getPermissions, getCapabilities, getCallsStatus }),

    // Wallet methods - platform implements
    eth_requestAccounts: async (req) => {
      if (rateLimiter.isLimited(req.meta.host))
        throw new RpcResponse.LimitExceededError();
      return showConnectUI(req);
    },
    eth_sendTransaction: async (req) => showSignUI(req),
    wallet_addEthereumChain: async (req) => {
      if (!featureFlags.customRpc)
        throw new RpcResponse.MethodNotSupportedError();
      return showAddChainUI(req);
    },

    custom: {
      wallet_revokePermissions: async (req) => {
        sessionStore.delete(req.meta.host);
        return null;
      },
    },
  },
});

emit.chainChanged('0x1');
```

### 4. Types

**Before:**

```ts
import { ChainIdHex } from '@rainbow-me/provider/references/ethereum';
import { Address } from 'viem';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
```

**After:**

```ts
import { Address, Hex, RpcTransport, RpcResponse } from 'ox';
import type {
  ProviderTransport,
  HandlerTransport,
  Session,
} from '@rainbow-me/provider';
```

### 5. Validation

**Before:** `isAddress()` from viem

**After:**

```ts
// Option A: Ox
Address.assert(address);

// Option B: Zod
import { address } from '@rainbow-me/provider/schemas';
address.parse(value);
```

### 6. Errors

**Before:** Manual error objects with `errorCodes`

**After:**

```ts
throw new RpcResponse.InvalidParamsError({ message: '...' });
throw new RpcResponse.MethodNotSupportedError();
throw new RpcResponse.LimitExceededError();
```

### 7. Personal Message Recovery

**Before:**

```ts
import { recoverPersonalSignature } from '@metamask/eth-sig-util';
const address = recoverPersonalSignature({ data: message, signature });
```

**After:**

```ts
import { Hash, Hex, PersonalMessage, Secp256k1, Signature } from 'ox';
const payload = Hash.keccak256(PersonalMessage.encode(Hex.fromString(message)));
const address = Secp256k1.recoverAddress({
  payload,
  signature: Signature.from(sig),
});
```

Or use `createLocalMethods()` which has `personal_ecRecover`.

### 8. RPC Forwarding

**Before:**

```ts
const provider = new StaticJsonRpcProvider(rpcUrl);
await provider.call({ to, data });
```

**After:**

```ts
const transport = RpcTransport.fromHttp(rpcUrl);
await transport.request({
  method: 'eth_call',
  params: [{ to, data }, 'latest'],
});
```

Or use `createRpcMethods({ transport })`.

---

## Removed Features

Now platform responsibility:

| Feature          | v1 Location              | v2                     |
| ---------------- | ------------------------ | ---------------------- |
| Rate limiting    | `checkRateLimit` param   | Your handler code      |
| Chain validation | `isSupportedChain` param | Your handler code      |
| Feature flags    | `getFeatureFlags` param  | Your handler code      |
| Session storage  | `getActiveSession` param | Your `getSession` impl |

---

## Events

**Before:** `onConstruct: ({ emit }) => { emit('chainChanged', ...) }`

**After:**

```ts
const { emit } = handleRequests({ transport, methods });
emit.chainChanged('0x1');
emit.accountsChanged(['0x...']);
emit.connect('0x1');
emit.disconnect({ code: 4001, message: 'Rejected' });
```

---

## Type Safety

```ts
// Return types inferred
const chainId = await provider.request({ method: 'eth_chainId' }); // `0x${string}`

// Handlers typed
const methods: TypedMethodHandlers = {
  eth_chainId: async () => '0x1',  // must return Hex
};

// Custom schemas
type MySchema = ExtendSchema<RpcSchema.From<{ Request: {...}; ReturnType: ... }>>;
const provider = createProvider<MySchema>({ transport });
```

---

## Checklist

- [ ] Update to `^0.2.0`, add `ox`
- [ ] Remove old deps
- [ ] Replace `new RainbowProvider()` → `createProvider()`
- [ ] Replace `handleProviderRequest()` → `handleRequests()`
- [ ] Implement transports
- [ ] Move rate limiting/validation to handlers
- [ ] Update types to Ox
- [ ] Update errors to `RpcResponse.*`
- [ ] Test all methods and events
