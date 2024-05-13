import {
  Provider,
  StaticJsonRpcProvider,
  TransactionRequest,
} from '@ethersproject/providers';

import { deriveChainIdByHostname, getDappHost, isValidUrl } from './utils/apps';
import { normalizeTransactionResponsePayload } from './utils/ethereum';
import { recoverPersonalSignature } from '@metamask/eth-sig-util';
import { AddEthereumChainProposedChain } from './references/chains';
import { Address, isAddress, isHex } from 'viem';
import {
  CallbackOptions,
  IProviderRequestTransport,
  ProviderRequestPayload,
  RequestError,
} from './references/messengers';
import { ActiveSession } from './references/appSession';
import { toHex } from './utils/hex';
import { errorCodes } from './references/errorCodes';
import { ChainNativeCurrency } from 'viem/_types/types/chain';

const buildError = ({
  id,
  message,
  errorCode,
}: {
  id: number;
  errorCode: {
    code: number;
    name: string;
  };
  message?: string;
}): { id: number; error: RequestError } => {
  return {
    id,
    error: {
      name: errorCode.name,
      message,
      code: errorCode.code,
    },
  };
};

export const handleProviderRequest = ({
  providerRequestTransport,
  getFeatureFlags,
  checkRateLimit,
  isSupportedChain,
  getActiveSession,
  getChainNativeCurrency,
  getProvider,
  messengerProviderRequest,
  onAddEthereumChain,
  onSwitchEthereumChainNotSupported,
  onSwitchEthereumChainSupported,
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
  isSupportedChain: (chainId: number) => boolean;
  getActiveSession: ({ host }: { host: string }) => ActiveSession;
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
}) =>
  providerRequestTransport?.reply(async ({ method, id, params }, meta) => {
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
            const supportedChain = isSupportedChain?.(proposedChainId);
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
            } else if (symbol.length < 2 || symbol.length > 6) {
              return buildError({
                id,
                message: `Expected 2-6 character string 'nativeCurrency.symbol'. Received: ${symbol}`,
                errorCode: errorCodes.INVALID_INPUT,
              });
              // Validate symbol against existing chains
            } else if (isSupportedChain?.(Number(chainId))) {
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
          const supportedChainId = isSupportedChain?.(
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
      return buildError({
        id,
        message: (error as Error).message,
        errorCode: errorCodes.INTERNAL_ERROR,
      });
    }
  });
