---
"@rainbow-me/provider": minor
---

Add [EIP-5792 Wallet Call API](https://eips.ethereum.org/EIPS/eip-5792) support

- Add `wallet_getCapabilities`, `wallet_sendCalls`, `wallet_getCallsStatus`, and `wallet_showCallsStatus` RPC method handlers
- Add `createProviderError` for typed pass-through errors from EIP-5792 callbacks
- Export `BatchRecord`, `BatchRecordBase`, `PendingBatchRecord`, `FinalBatchRecord`, and `RequestCapability` types
- **Breaking:** `handleProviderRequest` adds `getCapabilities`, `getBatchByKey`, `setBatch`, and `showCallsStatus` callback options and replaces `isSupportedChain` with `getSupportedChainIds`
  - Batch state and capability resolution are the caller's responsibility so the provider stays stateless
