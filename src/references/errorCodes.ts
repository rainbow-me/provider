// https://eips.ethereum.org/EIPS/eip-1474
export const errorCodes = {
  PARSE_ERROR: {
    code: -32700,
    name: 'Parse error	',
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
    name: 'Internal error	',
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
};
