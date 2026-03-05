import {
  Provider,
  StaticJsonRpcProvider,
  TransactionRequest,
} from '@ethersproject/providers';

import { deriveChainIdByHostname, getDappHost, isValidUrl } from './utils/apps';
import { normalizeTransactionResponsePayload } from './utils/ethereum';
import { recoverPersonalSignature } from '@metamask/eth-sig-util';
import { AddEthereumChainProposedChain } from './references/chains';
import {
  RequestCapability,
  SendCallsParams,
  SupportedCapability,
  BatchRecord,
  BatchRecordBase,
} from './references/ethereum';
import {
  getSendCallsIdValidationError,
  isBatchId,
} from './validation/sendCalls';
import { type Address, type Hex, isAddress, isHex } from 'viem';
import {
  CallbackOptions,
  IProviderRequestTransport,
  ProviderRequestPayload,
} from './references/messengers';
import { ActiveSession } from './references/appSession';
import { toHex } from './utils/hex';
import { errorCodes } from './references/errorCodes';
import { ChainNativeCurrency } from 'viem/_types/types/chain';

import { buildError, isPassThroughError, toPassThroughResponse } from './error';

export { createProviderError } from './error';

const isCapabilityOptional = (cap: RequestCapability) =>
  cap && typeof cap === 'object' && cap.optional === true;

/**
 * Returns true if the capability is supported. For atomic capability, also accepts
 * 'ready' status: EIP-7702 delegated accounts that can execute atomic batches
 * report 'ready' (not just 'supported'). This diverges from strict EIP-5792 spec
 * but is correct for our type 4 + batch call flow.
 */
const isCapabilitySupported = (
  supported: Record<string, SupportedCapability> | undefined,
  name: string,
): boolean => {
  const cap = supported?.[name];
  if (!cap) return false;
  if ('status' in cap)
    return cap.status === 'supported' || cap.status === 'ready';
  if ('supported' in cap) return cap.supported === true;
  return false;
};

const getRequiredCapabilities = (sendParams: SendCallsParams): Set<string> => {
  const required = new Set<string>();
  if (sendParams.atomicRequired) required.add('atomic');
  for (const [name, cap] of Object.entries(sendParams.capabilities ?? {})) {
    if (!isCapabilityOptional(cap as RequestCapability)) required.add(name);
  }
  for (const call of sendParams.calls) {
    for (const [name, cap] of Object.entries(call.capabilities ?? {})) {
      if (!isCapabilityOptional(cap as RequestCapability)) required.add(name);
    }
  }
  return required;
};

interface WalletPermissionsParams {
  eth_accounts: object;
}

export const handleProviderRequest = ({
  providerRequestTransport,
  getFeatureFlags,
  checkRateLimit,
  getSupportedChainIds,
  getActiveSession,
  removeAppSession,
  getChainNativeCurrency,
  getProvider,
  messengerProviderRequest,
  onAddEthereumChain,
  onSwitchEthereumChainNotSupported,
  onSwitchEthereumChainSupported,
  getCapabilities,
  getBatchByKey,
  setBatch,
  showCallsStatus,
}: {
  providerRequestTransport: IProviderRequestTransport;
  getFeatureFlags: () => { custom_rpc: boolean };
  checkRateLimit: ({
    id,
    meta,
    method,
  }: {
    id: number;
    meta: CallbackOptions;
    method: string;
  }) => Promise<{ id: number; error: Error } | undefined>;
  getSupportedChainIds: () => number[];
  getActiveSession: ({ host }: { host: string }) => ActiveSession;
  removeAppSession?: ({ host }: { host: string }) => void;
  getChainNativeCurrency: (chainId: number) => ChainNativeCurrency | undefined;
  getProvider: (options: { chainId?: number }) => Provider;
  messengerProviderRequest: (
    request: ProviderRequestPayload,
  ) => Promise<object>;
  onAddEthereumChain: ({
    proposedChain,
    callbackOptions,
  }: {
    proposedChain: AddEthereumChainProposedChain;
    callbackOptions?: CallbackOptions;
  }) => { chainAlreadyAdded: boolean };
  onSwitchEthereumChainNotSupported: ({
    proposedChain,
    callbackOptions,
  }: {
    proposedChain: AddEthereumChainProposedChain;
    callbackOptions?: CallbackOptions;
  }) => void;
  onSwitchEthereumChainSupported: ({
    proposedChain,
    callbackOptions,
  }: {
    proposedChain: AddEthereumChainProposedChain;
    callbackOptions?: CallbackOptions;
  }) => void;
  getCapabilities?: (params: {
    address: Address;
    chainIds: number[];
  }) => Promise<Record<number, Record<string, SupportedCapability>>>;
  getBatchByKey?: (params: {
    id: string;
    sender: Address;
    app: string;
  }) => Promise<BatchRecord | undefined> | BatchRecord | undefined;
  showCallsStatus?: (params: {
    batchId: string;
    sender: Address;
    app: string;
    chainId: number;
    tabId: string;
  }) => void | Promise<void>;
  setBatch?: (record: BatchRecordBase) => void;
}) =>
  providerRequestTransport?.reply(async ({ method, id, params }, meta) => {
    const isSupportedChain = (chainId: number) =>
      getSupportedChainIds().includes(chainId);
    try {
      const rateLimited = await checkRateLimit({ id, meta, method });
      if (rateLimited) {
        return buildError({
          id,
          message: 'Rate Limit Exceeded',
          errorCode: errorCodes.LIMIT_EXCEEDED,
        });
      }

      const url = meta?.sender?.url || '';
      const host = (isValidUrl(url) && getDappHost(url)) || '';
      const activeSession = getActiveSession({ host });

      let response: unknown = null;

      switch (method) {
        case 'eth_chainId': {
          response = activeSession ? toHex(activeSession.chainId) : '0x1';
          break;
        }
        case 'eth_coinbase': {
          response = activeSession?.address?.toLowerCase() || '';
          break;
        }
        case 'eth_accounts': {
          response = activeSession
            ? [activeSession.address?.toLowerCase()]
            : [];
          break;
        }
        case 'eth_blockNumber': {
          const provider = getProvider({ chainId: activeSession?.chainId });
          const blockNumber = await provider.getBlockNumber();
          response = toHex(blockNumber);
          break;
        }
        case 'eth_getBalance': {
          const p = params as Array<unknown>;
          const provider = getProvider({ chainId: activeSession?.chainId });
          const balance = await provider.getBalance(p?.[0] as string);
          response = toHex(balance);
          break;
        }
        case 'eth_getTransactionByHash': {
          const p = params as Array<unknown>;
          const provider = getProvider({ chainId: activeSession?.chainId });
          const transaction = await provider.getTransaction(p?.[0] as string);
          const normalizedTransaction =
            normalizeTransactionResponsePayload(transaction);
          const {
            gasLimit,
            gasPrice,
            maxFeePerGas,
            maxPriorityFeePerGas,
            value,
          } = normalizedTransaction;
          response = {
            ...normalizedTransaction,
            gasLimit: toHex(gasLimit),
            gasPrice: gasPrice ? toHex(gasPrice) : undefined,
            maxFeePerGas: maxFeePerGas ? toHex(maxFeePerGas) : undefined,
            maxPriorityFeePerGas: maxPriorityFeePerGas
              ? toHex(maxPriorityFeePerGas)
              : undefined,
            value: toHex(value),
          };
          break;
        }
        case 'eth_call': {
          const p = params as Array<unknown>;
          const provider = getProvider({ chainId: activeSession?.chainId });
          response = await provider.call(p?.[0] as TransactionRequest);
          break;
        }
        case 'eth_estimateGas': {
          const p = params as Array<unknown>;
          const provider = getProvider({ chainId: activeSession?.chainId });
          const gas = await provider.estimateGas(p?.[0] as TransactionRequest);
          response = toHex(gas);
          break;
        }
        case 'eth_gasPrice': {
          const provider = getProvider({ chainId: activeSession?.chainId });
          const gasPrice = await provider.getGasPrice();
          response = toHex(gasPrice);
          break;
        }
        case 'eth_getCode': {
          const p = params as Array<unknown>;
          const provider = getProvider({ chainId: activeSession?.chainId });
          response = await provider.getCode(p?.[0] as string, p?.[1] as string);
          break;
        }
        case 'eth_sendTransaction':
        case 'eth_signTransaction':
        case 'personal_sign':
        case 'eth_signTypedData':
        case 'eth_signTypedData_v3':
        case 'eth_signTypedData_v4': {
          // If we need to validate the input before showing the UI, it should go here.
          const p = params as Array<unknown>;
          if (method === 'eth_signTypedData_v4') {
            // we don't trust the params order
            let dataParam = p?.[1];
            if (!isAddress(p?.[0] as Address)) {
              dataParam = p?.[0];
            }

            const data =
              typeof dataParam === 'string' ? JSON.parse(dataParam) : dataParam;

            const {
              domain: { chainId },
            } = data as { domain: { chainId: string } };

            if (
              chainId !== undefined &&
              Number(chainId) !== Number(activeSession?.chainId)
            ) {
              return buildError({
                id,
                message: 'Chain Id mismatch',
                errorCode: errorCodes.INVALID_REQUEST,
              });
            }
          }

          response = await messengerProviderRequest({
            method,
            id,
            params,
            meta,
          });
          break;
        }
        case 'wallet_addEthereumChain': {
          const p = params as Array<unknown>;
          const proposedChain = p?.[0] as AddEthereumChainProposedChain;
          const proposedChainId = Number(proposedChain.chainId);
          const featureFlags = getFeatureFlags();
          if (!featureFlags.custom_rpc) {
            const supportedChain = isSupportedChain(proposedChainId);
            if (!supportedChain) {
              return buildError({
                id,
                message: 'Chain Id not supported',
                errorCode: errorCodes.INVALID_REQUEST,
              });
            }
          } else {
            const {
              chainId,
              rpcUrls: [rpcUrl],
              nativeCurrency: { name, symbol, decimals },
              blockExplorerUrls: [blockExplorerUrl],
            } = proposedChain;

            // Validate chain Id
            if (!isHex(chainId)) {
              return buildError({
                id,
                message: `Expected 0x-prefixed, unpadded, non-zero hexadecimal string "chainId". Received: ${chainId}`,
                errorCode: errorCodes.INVALID_INPUT,
              });
            } else if (Number(chainId) > Number.MAX_SAFE_INTEGER) {
              return buildError({
                id,
                message: `Invalid chain ID "${chainId}": numerical value greater than max safe value. Received: ${chainId}`,
                errorCode: errorCodes.INVALID_INPUT,
              });
              // Validate symbol and name
            } else if (!rpcUrl) {
              return buildError({
                id,
                message: `Expected non-empty array[string] "rpcUrls". Received: ${rpcUrl}`,
                errorCode: errorCodes.INVALID_INPUT,
              });
            } else if (!name || !symbol) {
              return buildError({
                id,
                message:
                  'Expected non-empty string "nativeCurrency.name", "nativeCurrency.symbol"',
                errorCode: errorCodes.INVALID_INPUT,
              });
              // Validate decimals
            } else if (
              !Number.isInteger(decimals) ||
              decimals < 0 ||
              decimals > 36
            ) {
              return buildError({
                id,
                message: `Expected non-negative integer "nativeCurrency.decimals" less than 37. Received: ${decimals}`,
                errorCode: errorCodes.INVALID_INPUT,
              });
              // Validate symbol length
            } else if (symbol.length < 1 || symbol.length > 6) {
              return buildError({
                id,
                message: `Expected 1-6 character string 'nativeCurrency.symbol'. Received: ${symbol}`,
                errorCode: errorCodes.INVALID_INPUT,
              });
              // Validate symbol against existing chains
            } else if (isSupportedChain(Number(chainId))) {
              const knownChainNativeCurrency = getChainNativeCurrency(
                Number(chainId),
              );
              if (knownChainNativeCurrency?.symbol !== symbol) {
                return buildError({
                  id,
                  message: `nativeCurrency.symbol does not match currency symbol for a network the user already has added with the same chainId. Received: ${symbol}`,
                  errorCode: errorCodes.INVALID_INPUT,
                });
              }
              // Validate blockExplorerUrl
            } else if (!blockExplorerUrl) {
              return buildError({
                id,
                message: `Expected null or array with at least one valid string HTTPS URL 'blockExplorerUrl'. Received: ${blockExplorerUrl}`,
                errorCode: errorCodes.INVALID_INPUT,
              });
            }
            const { chainAlreadyAdded } = onAddEthereumChain({
              proposedChain,
              callbackOptions: meta,
            });

            if (!chainAlreadyAdded) {
              response = await messengerProviderRequest({
                method,
                id,
                params,
                meta,
              });
            }

            // PER EIP - return null if the network was added otherwise throw
            if (!response) {
              return buildError({
                id,
                message: 'User rejected the request.',
                errorCode: errorCodes.TRANSACTION_REJECTED,
              });
            } else {
              response = null;
            }
          }
          break;
        }
        case 'wallet_switchEthereumChain': {
          const p = params as Array<unknown>;
          const proposedChain = p?.[0] as AddEthereumChainProposedChain;
          const supportedChainId = isSupportedChain(
            Number(proposedChain.chainId),
          );
          if (!activeSession) {
            (await messengerProviderRequest({
              method: 'eth_requestAccounts',
              id,
              params,
              meta,
            })) as { address: Address; chainId: number };
          } else if (!supportedChainId) {
            onSwitchEthereumChainNotSupported?.({
              proposedChain,
              callbackOptions: meta,
            });
            return buildError({
              id,
              message: 'Chain Id not supported',
              errorCode: errorCodes.INVALID_REQUEST,
            });
          } else {
            onSwitchEthereumChainSupported?.({
              proposedChain,
              callbackOptions: meta,
            });
          }
          response = null;
          break;
        }
        case 'wallet_watchAsset': {
          const featureFlags = getFeatureFlags();

          if (!featureFlags.custom_rpc) {
            throw new Error('Method not supported');
          } else {
            const {
              type,
              options: { address, symbol, decimals },
            } = params as unknown as {
              type: string;
              options: {
                address: Address;
                symbol?: string;
                decimals?: number;
              };
            };
            if (type !== 'ERC20') {
              return buildError({
                id,
                message: 'Method supported only for ERC20',
                errorCode: errorCodes.METHOD_NOT_SUPPORTED,
              });
            }

            if (!address) {
              return buildError({
                id,
                message: 'Address is required',
                errorCode: errorCodes.INVALID_INPUT,
              });
            }

            let chainId: number | null = null;
            if (activeSession) {
              chainId = activeSession?.chainId;
            } else {
              chainId = deriveChainIdByHostname(host);
            }

            response = await messengerProviderRequest({
              method,
              id,
              params: [
                {
                  address,
                  symbol,
                  decimals,
                  chainId,
                },
              ],
              meta,
            });
            // PER EIP - true if the token was added, false otherwise.
            response = !!response;
            break;
          }
        }
        case 'eth_requestAccounts': {
          if (activeSession) {
            response = [activeSession.address?.toLowerCase()];
            break;
          }
          const { address } = (await messengerProviderRequest({
            method,
            id,
            params,
            meta,
          })) as { address: Address; chainId: number };
          response = [address?.toLowerCase()];
          break;
        }
        case 'personal_ecRecover': {
          const p = params as Array<unknown>;
          response = recoverPersonalSignature({
            data: p?.[0] as string,
            signature: p?.[1] as string,
          });
          break;
        }
        case 'wallet_getCapabilities': {
          if (!getCapabilities) {
            return buildError({
              id,
              message: 'Method not supported',
              errorCode: errorCodes.METHOD_NOT_SUPPORTED,
            });
          }
          const p = params as Array<unknown>;
          const address = p?.[0] as Address;
          const chainIdsParam = p?.[1] as Hex[] | undefined;
          if (!activeSession || !address) {
            return buildError({
              id,
              message: 'Unauthorized',
              errorCode: { code: 4100, name: 'Unauthorized' },
            });
          }
          const sessionAddress = activeSession.address?.toLowerCase();
          const requestedAddress = address?.toLowerCase?.();
          if (sessionAddress !== requestedAddress) {
            return buildError({
              id,
              message: 'Unauthorized',
              errorCode: { code: 4100, name: 'Unauthorized' },
            });
          }
          const chainIds = chainIdsParam?.length
            ? chainIdsParam.map((c) => Number(c))
            : getSupportedChainIds();
          const supportedChainIds = chainIds.filter(isSupportedChain);
          const capabilities = await getCapabilities({
            address,
            chainIds: supportedChainIds,
          });
          const result: Record<string, Record<string, unknown>> = {};
          for (const chainId of supportedChainIds) {
            result[toHex(chainId) as Hex] = (capabilities[chainId] ??
              {}) as Record<string, unknown>;
          }
          response = result;
          break;
        }
        case 'wallet_getCallsStatus': {
          if (!getBatchByKey) {
            return buildError({
              id,
              message: 'Method not supported',
              errorCode: errorCodes.METHOD_NOT_SUPPORTED,
            });
          }
          const p = params as Array<unknown>;
          const batchId = p?.[0];
          if (!isBatchId(batchId)) {
            const idError = getSendCallsIdValidationError(batchId);
            return buildError({
              id,
              message: idError?.message ?? 'Invalid params',
              errorCode: errorCodes.INVALID_PARAMS,
            });
          }
          if (!activeSession) {
            return buildError({
              id,
              message: 'Unknown batch id',
              errorCode: errorCodes.UNKNOWN_BATCH_ID,
            });
          }
          const sender = activeSession.address;
          const app = host;
          const batch = await Promise.resolve(
            getBatchByKey({
              id: batchId,
              sender,
              app,
            }),
          );
          if (!batch) {
            return buildError({
              id,
              message: 'Unknown batch id',
              errorCode: errorCodes.UNKNOWN_BATCH_ID,
            });
          }
          response = {
            version: '2.0.0',
            id: batch.id,
            chainId: toHex(batch.chainId) as Hex,
            status: batch.status,
            atomic: batch.atomic,
            ...('receipts' in batch && batch.receipts
              ? { receipts: batch.receipts }
              : {}),
          };
          break;
        }
        case 'wallet_sendCalls': {
          if (!setBatch || !getBatchByKey || !getCapabilities) {
            return buildError({
              id,
              message: 'Method not supported',
              errorCode: errorCodes.METHOD_NOT_SUPPORTED,
            });
          }
          const p = params as Array<unknown>;
          const sendParams = p?.[0] as SendCallsParams;
          if (
            !sendParams?.version ||
            !sendParams?.chainId ||
            !sendParams?.calls ||
            !sendParams?.from ||
            sendParams?.atomicRequired == null
          ) {
            return buildError({
              id,
              message: 'Invalid params',
              errorCode: errorCodes.INVALID_PARAMS,
            });
          }
          if (!isAddress(sendParams.from)) {
            return buildError({
              id,
              message: 'Invalid from address',
              errorCode: errorCodes.INVALID_PARAMS,
            });
          }
          if (sendParams.id && !isBatchId(sendParams.id)) {
            const idError = getSendCallsIdValidationError(sendParams.id);
            return buildError({
              id,
              message: idError?.message ?? 'Invalid params',
              errorCode: errorCodes.INVALID_PARAMS,
            });
          }
          const chainId = Number(sendParams.chainId);
          if (!isSupportedChain(chainId)) {
            return buildError({
              id,
              message: 'Unsupported chain id',
              errorCode: errorCodes.UNSUPPORTED_CHAIN_ID,
            });
          }
          if (!activeSession) {
            return buildError({
              id,
              message: 'Unauthorized',
              errorCode: { code: 4100, name: 'Unauthorized' },
            });
          }
          if (
            sendParams.from.toLowerCase() !==
            activeSession.address.toLowerCase()
          ) {
            return buildError({
              id,
              message: 'from address does not match connected account',
              errorCode: { code: 4100, name: 'Unauthorized' },
            });
          }
          const sender = activeSession.address;
          const app = host;
          const atomicRequired = sendParams.atomicRequired;

          const caps = await getCapabilities({
            address: sender,
            chainIds: [chainId],
          });
          const requiredCaps = getRequiredCapabilities(sendParams);
          if (requiredCaps.size > 0) {
            const chainCaps = caps[chainId];

            for (const name of Array.from(requiredCaps)) {
              if (!isCapabilitySupported(chainCaps, name)) {
                return buildError({
                  id,
                  message:
                    name === 'atomic'
                      ? 'Atomicity not supported'
                      : 'Unsupported non-optional capability',
                  errorCode:
                    name === 'atomic'
                      ? errorCodes.ATOMICITY_NOT_SUPPORTED
                      : errorCodes.UNSUPPORTED_NON_OPTIONAL_CAPABILITY,
                });
              }
            }
          }

          let batchId = sendParams.id;
          if (batchId) {
            const existing = await Promise.resolve(
              getBatchByKey({ id: batchId, sender, app }),
            );
            if (existing) {
              return buildError({
                id,
                message: 'Duplicate batch id',
                errorCode: errorCodes.DUPLICATE_BATCH_ID,
              });
            }
          } else {
            const bytes = new Uint8Array(32);
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
              crypto.getRandomValues(bytes);
            }
            batchId = `0x${Array.from(bytes)
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('')}`;
          }
          setBatch({
            id: batchId,
            sender,
            app,
            chainId,
            atomic: atomicRequired,
          });
          response = await messengerProviderRequest({
            method,
            id,
            params: [{ ...sendParams, id: batchId }],
            meta,
          });
          break;
        }
        case 'wallet_showCallsStatus': {
          if (!getBatchByKey || !showCallsStatus) {
            return buildError({
              id,
              message: 'Method not supported',
              errorCode: errorCodes.METHOD_NOT_SUPPORTED,
            });
          }
          const p = params as Array<unknown>;
          const batchId = p?.[0];
          if (!isBatchId(batchId)) {
            const idError = getSendCallsIdValidationError(batchId);
            return buildError({
              id,
              message: idError?.message ?? 'Invalid params',
              errorCode: errorCodes.INVALID_PARAMS,
            });
          }
          if (!activeSession) {
            return buildError({
              id,
              message: 'Unknown batch id',
              errorCode: errorCodes.UNKNOWN_BATCH_ID,
            });
          }
          const batch = await Promise.resolve(
            getBatchByKey({
              id: batchId,
              sender: activeSession.address,
              app: host,
            }),
          );
          if (!batch) {
            return buildError({
              id,
              message: 'Unknown batch id',
              errorCode: errorCodes.UNKNOWN_BATCH_ID,
            });
          }
          const tabId = String(meta?.sender?.tab?.id ?? '');
          await showCallsStatus({
            batchId,
            sender: activeSession.address,
            app: host,
            chainId: batch.chainId,
            tabId,
          });
          response = null;
          break;
        }
        case 'wallet_revokePermissions': {
          if (
            !!removeAppSession &&
            (params?.[0] as WalletPermissionsParams)?.eth_accounts
          ) {
            removeAppSession?.({ host });
            response = null;
          }
          throw new Error('next');
        }
        default: {
          try {
            if (method?.substring(0, 7) === 'wallet_') {
              // Generic error that will be hanlded correctly in the catch
              throw new Error('next');
            }
            // Let's try to fwd the request to the provider
            const provider = getProvider({
              chainId: activeSession?.chainId,
            }) as StaticJsonRpcProvider;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            response = await provider.send(method, params as any[]);
          } catch (e) {
            return buildError({
              id,
              message: 'Method not supported',
              errorCode: errorCodes.METHOD_NOT_SUPPORTED,
            });
          }
        }
      }
      return { id, result: response };
    } catch (error) {
      if (isPassThroughError(error)) return toPassThroughResponse(id, error);
      return buildError({
        id,
        message: (error as Error).message,
        errorCode: errorCodes.INTERNAL_ERROR,
      });
    }
  });
