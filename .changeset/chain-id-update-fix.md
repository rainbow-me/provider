---
"@rainbow-me/provider": patch
---

Fix chainId synchronization on chain change events

The provider's chainId wasn't updating when networks changed, causing requests to fail. Now properly syncs chainId state with network changes.
