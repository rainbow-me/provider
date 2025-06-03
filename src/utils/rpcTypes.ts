import type { Hex, Address, BlockTag } from 'viem';
import type { TransactionRequest } from 'viem';
import type { AddEthereumChainProposedChain } from '../references/chains';

// Interface for wallet permissions params
interface WalletPermissionsParams {
  eth_accounts: object;
}

// Interface for watch asset params
interface WatchAssetParams {
  type: 'ERC20';
  options: {
    address: Address;
    symbol?: string;
    decimals?: number;
  };
}

// Interface for switch chain params
interface SwitchChainParams {
  chainId: string;
}

// Discriminated union type for RPC method requests
export type RPCMethodRequest = 
  // Methods with no parameters
  | { method: 'eth_chainId'; params?: never }
  | { method: 'eth_coinbase'; params?: never }
  | { method: 'eth_accounts'; params?: never }
  | { method: 'eth_blockNumber'; params?: never }
  | { method: 'eth_gasPrice'; params?: never }
  | { method: 'eth_requestAccounts'; params?: never }
  
  // Methods with single address parameter
  | { method: 'eth_getBalance'; params: [Address] }
  | { method: 'eth_getTransactionByHash'; params: [Hex] }
  
  // Methods with address and optional block tag
  | { method: 'eth_getCode'; params: [Address, BlockTag?] }
  
  // Methods with transaction request
  | { method: 'eth_call'; params: [TransactionRequest] }
  | { method: 'eth_estimateGas'; params: [TransactionRequest] }
  | { method: 'eth_sendTransaction'; params: [TransactionRequest] }
  | { method: 'eth_signTransaction'; params: [TransactionRequest] }
  
  // Signing methods with message and address
  | { method: 'personal_sign'; params: [string, Address] }
  | { method: 'personal_ecRecover'; params: [string, string] }
  
  // Typed data signing methods (address can be first or second param)
  | { method: 'eth_signTypedData'; params: [Address, any] | [any, Address] }
  | { method: 'eth_signTypedData_v3'; params: [Address, any] | [any, Address] }
  | { method: 'eth_signTypedData_v4'; params: [Address, any] | [any, Address] }
  
  // Wallet methods
  | { method: 'wallet_addEthereumChain'; params: [AddEthereumChainProposedChain] }
  | { method: 'wallet_switchEthereumChain'; params: [SwitchChainParams] }
  | { method: 'wallet_watchAsset'; params: [WatchAssetParams] }
  | { method: 'wallet_revokePermissions'; params: [WalletPermissionsParams] }
  
  // Generic fallback for unknown methods
  | { method: string; params?: unknown[] };

// Helper type to extract parameters for a specific method
export type ParamsForMethod<T extends RPCMethodRequest['method']> = 
  Extract<RPCMethodRequest, { method: T }>['params'];

// Type-safe parameter extractors for each method
export function getBalanceParams(params: unknown[]): [Address] {
  return [params[0] as Address];
}

export function getTransactionByHashParams(params: unknown[]): [Hex] {
  return [params[0] as Hex];
}

export function getCodeParams(params: unknown[]): [Address, BlockTag?] {
  return [params[0] as Address, params[1] as BlockTag];
}

export function getCallParams(params: unknown[]): [TransactionRequest] {
  return [params[0] as TransactionRequest];
}

export function getEstimateGasParams(params: unknown[]): [TransactionRequest] {
  return [params[0] as TransactionRequest];
}

export function getSigningParams(params: unknown[]): [string, string] {
  return [params[0] as string, params[1] as string];
}

export function getAddChainParams(params: unknown[]): [AddEthereumChainProposedChain] {
  return [params[0] as AddEthereumChainProposedChain];
}

export function getSwitchChainParams(params: unknown[]): [SwitchChainParams] {
  return [params[0] as SwitchChainParams];
}

export function getWatchAssetParams(params: unknown[]): [WatchAssetParams] {
  return [params[0] as WatchAssetParams];
}

export function getRevokePermissionsParams(params: unknown[]): [WalletPermissionsParams] {
  return [params[0] as WalletPermissionsParams];
}

// Export the interfaces for use in other files
export type { WalletPermissionsParams, WatchAssetParams, SwitchChainParams }; 