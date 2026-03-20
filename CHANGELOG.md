# @rainbow-me/provider

## 0.2.0

### Minor Changes

- 3fffda9: Add [EIP-5792 Wallet Call API](https://eips.ethereum.org/EIPS/eip-5792) support

  - Add `wallet_getCapabilities`, `wallet_sendCalls`, `wallet_getCallsStatus`, and `wallet_showCallsStatus` RPC method handlers
  - Add `createProviderError` for typed pass-through errors from EIP-5792 callbacks
  - Export `BatchRecord`, `BatchRecordBase`, `PendingBatchRecord`, `FinalBatchRecord`, `SendCallsParams`, and `RequestCapability` types
  - **Breaking:** `handleProviderRequest` adds `getCapabilities`, `getBatchByKey`, `setBatch`, and `showCallsStatus` callback options and replaces `isSupportedChain` with `getSupportedChainIds`
    - Batch state and capability resolution are the caller's responsibility so the provider stays stateless

## 0.1.3

### Patch Changes

- dba6685: Allow 1-6 character native currency symbols

  Validation was rejecting valid symbols like Sonic's "S" gas token. Updated to accept symbols between 1-6 characters to support additional networks.

## 0.1.2

### Patch Changes

- dba6685: Fix chainId synchronization on chain change events

  The provider's chainId wasn't updating when networks changed, causing requests to fail. Now properly syncs chainId state with network changes.
