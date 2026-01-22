// Core exports
export { createProvider } from './createProvider';
export type { RainbowProvider } from './createProvider';

export { handleRequests } from './handleRequests';
export type { EmitFunctions } from './handleRequests';

// Transport types
export type {
  // Base transport interfaces
  ProviderTransport,
  HandlerTransport,
  // Type-safe wrappers (for full request/response type matching)
  TypedProviderTransport,
  TypedRequestFn,
  TypedMethodHandler,
  TypedMethodHandlers,
  // Event types
  ProviderEvent,
  ConnectEvent,
  DisconnectEvent,
  ChainChangedEvent,
  AccountsChangedEvent,
  // Request types
  WalletRequest,
  WalletRequestMeta,
  // Handler types
  MethodHandler,
  MethodHandlers,
  // Session & permissions
  Session,
  WalletPermission,
  WalletPermissionCaveat,
  CallsStatus,
  // Schema helpers
  RpcSchema,
  DefaultSchema,
  ExtendSchema,
} from './transports';
