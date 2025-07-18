# @rainbow-me/provider

## 0.1.2

### Patch Changes

- dba6685: Fix chainId synchronization on chain change events

  The provider's chainId wasn't updating when networks changed, causing requests to fail. Now properly syncs chainId state with network changes.

- dba6685: Allow 1-6 character native currency symbols

  Validation was rejecting valid symbols like Sonic's "S" gas token. Updated to accept symbols between 1-6 characters to support additional networks.
