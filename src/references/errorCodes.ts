// https://eips.ethereum.org/EIPS/eip-1474
export const errorCodes = {
  PARSE_ERROR: {
    code: -32700,
    name: 'Parse error',
  }, // Invalid JSON
  INVALID_REQUEST: {
    code: -32600,
    name: 'Invalid Request',
  }, // JSON is not a valid request object
  METHOD_NOT_FOUND: {
    code: -32601,
    name: 'Method not found',
  }, // Method does not exist
  INVALID_PARAMS: {
    code: -32602,
    name: 'Invalid params',
  }, // Invalid method parameters
  INTERNAL_ERROR: {
    code: -32603,
    name: 'Internal error',
  }, // Internal JSON-RPC error
  INVALID_INPUT: {
    code: -32000,
    name: 'Invalid input',
  }, // Missing or invalid parameters
  RESOURCE_NOT_FOUND: {
    code: -32001,
    name: 'Resource not found',
  }, // Requested resource not found
  RESOURCE_UNAVAILABLE: {
    code: -32002,
    name: 'Resource unavailable',
  }, // Requested resource not available
  TRANSACTION_REJECTED: {
    code: -32003,
    name: 'Transaction rejected',
  }, // Transaction creation failed
  METHOD_NOT_SUPPORTED: {
    code: -32004,
    name: 'Method not supported',
  }, // Method is not implemented
  LIMIT_EXCEEDED: {
    code: -32005,
    name: 'Limit exceeded',
  }, // Request exceeds defined limit
  JSON_RPC_VERSION_NOT_SUPPORTED: {
    code: -32006,
    name: 'JSON-RPC version not supported',
  }, // Version of JSON-RPC protocol is not supported
  // EIP-5792 batch errors
  UNSUPPORTED_NON_OPTIONAL_CAPABILITY: {
    code: 5700,
    name: 'Unsupported non-optional capability',
  }, // Capability not marked optional is not supported by wallet
  UNSUPPORTED_CHAIN_ID: {
    code: 5710,
    name: 'Unsupported chain id',
  },
  DUPLICATE_BATCH_ID: {
    code: 5720,
    name: 'Duplicate batch id',
  }, // Batch id already exists for (id, sender, app)
  UNKNOWN_BATCH_ID: {
    code: 5730,
    name: 'Unknown batch id',
  }, // Batch not found
  ATOMIC_UPGRADE_REJECTED: {
    code: 5740,
    name: 'Atomic upgrade rejected',
  },
  BUNDLE_TOO_LARGE: {
    code: 5750,
    name: 'Bundle too large',
  },
  ATOMICITY_NOT_SUPPORTED: {
    code: 5760,
    name: 'Atomicity not supported',
  },
};
