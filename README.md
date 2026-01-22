# Rainbow Provider

[![npm](https://badge.fury.io/js/@rainbow-me%2Fprovider.svg)](https://www.npmjs.com/package/@rainbow-me/provider)
[![MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

EIP-1193 Ethereum provider. Built on [Ox](https://oxlib.sh).

## Install

```bash
yarn add @rainbow-me/provider ox
yarn add zod  # optional, for schemas
```

## Quick Start

```ts
import { createProvider, handleRequests } from '@rainbow-me/provider';
import {
  createSessionMethods,
  createRpcMethods,
} from '@rainbow-me/provider/defaults';
import { RpcTransport } from 'ox';

// Injected side
const provider = createProvider({ transport: providerTransport });

// Handler side
const { emit } = handleRequests({
  transport: handlerTransport,
  methods: {
    ...createSessionMethods({ getSession }),
    ...createRpcMethods({ transport: RpcTransport.fromHttp('https://...') }),
    eth_requestAccounts: async (req) => showConnectUI(req),
  },
});

emit.chainChanged('0x1');
emit.accountsChanged(['0x...']);
```

## EIP-6963

Use `mipd` directly:

```ts
import { announceProvider } from 'mipd';
const provider = createProvider({ transport });
announceProvider({
  info: {
    uuid: crypto.randomUUID(),
    name: 'Rainbow',
    icon: '...',
    rdns: 'me.rainbow',
  },
  provider,
});
```

## Exports

### `@rainbow-me/provider`

**Functions:** `createProvider`, `handleRequests`

**Types:** `ProviderTransport`, `HandlerTransport`, `TypedProviderTransport<S>`, `TypedMethodHandlers<S>`, `ProviderEvent`, `MethodHandlers`, `Session`, `RpcSchema`, `ExtendSchema<T>`, `DefaultSchema`

### `@rainbow-me/provider/defaults`

- `createSessionMethods({ getSession })` → `eth_chainId`, `eth_accounts`, `eth_coinbase`
- `createRpcMethods({ transport })` → forwards `eth_*` to RPC node
- `createLocalMethods({ ... })` → `personal_ecRecover`, `wallet_getPermissions`, etc.

### `@rainbow-me/provider/schemas`

Zod schemas: `ethSendTransactionParams`, `walletAddEthereumChainParams`, `providerEvent`, etc.

## Transport Interface

Platform implements for their messaging:

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

## Type Safety

Return types inferred from method name:

```ts
const chainId = await provider.request({ method: 'eth_chainId' }); // `0x${string}`
const accounts = await provider.request({ method: 'eth_accounts' }); // readonly Address[]
```

Custom methods:

```ts
type MyMethods = RpcSchema.From<{
  Request: { method: 'rainbow_getProfile'; params: [address: `0x${string}`] };
  ReturnType: { name: string };
}>;
type MySchema = ExtendSchema<MyMethods>;

const provider = createProvider<MySchema>({ transport });
const profile = await provider.request({
  method: 'rainbow_getProfile',
  params: ['0x...'],
});
// profile: { name: string }
```

Typed handlers:

```ts
const methods: TypedMethodHandlers = {
  eth_chainId: async () => '0x1', // must return Hex
  eth_accounts: async () => ['0x...'], // must return Address[]
};
```

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Architecture
- [docs/MIGRATION.md](docs/MIGRATION.md) — Migration guide

## Dev

```bash
nvm use && corepack enable
yarn install
yarn build
yarn test
yarn typecheck
yarn lint
```

## License

MIT © Rainbow
