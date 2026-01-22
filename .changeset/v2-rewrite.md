---
'@rainbow-me/provider': minor
---

v2 rewrite: Ox-based EIP-1193 provider

- `createProvider()` replaces `RainbowProvider` class
- `handleRequests()` replaces `handleProviderRequest()`
- Full TypeScript type safety via Ox RpcSchema
- Removed: @ethersproject/\*, viem, eventemitter3, @metamask/eth-sig-util
- Added: ox (core), zod (optional peer dep for schemas)
- New exports: `@rainbow-me/provider/defaults`, `@rainbow-me/provider/schemas`
