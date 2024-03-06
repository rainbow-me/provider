import {
  Provider,
  StaticJsonRpcProvider,
  TransactionRequest,
} from '@ethersproject/providers';

import { deriveChainIdByHostname, getDappHost, isValidUrl } from './utils/apps';
import { normalizeTransactionResponsePayload } from './utils/ethereum';
import { recoverPersonalSignature } from '@metamask/eth-sig-util';
import { AddEthereumChainProposedChain, Chain } from './references/chains';
import { Address, isAddress, isHex } from 'viem';
import {
  CallbackOptions,
  IProviderRequestTransport,
  ProviderRequestPayload,
} from './references/messengers';
import { ActiveSession } from './references/appSession';
import { toHex } from './utils/hex';

export const handleProviderRequest = ({
  providerRequestTransport,
  getFeatureFlags,
  checkRateLimit,
  isSupportedChain,
  getActiveSession,
  getChain,
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
  getChain: (chainId: number) => Chain | undefined;
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
        return { id, error: <Error>new Error('Rate Limit Exceeded') };
      }

      const url = meta?.sender?.url || '';
      const host = (isValidUrl(url) && getDappHost(url)) || '';
      const activeSession = getActiveSession({ host });

      let response = null;

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
              throw new Error('ChainId mismatch');
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
            if (!supportedChain) throw new Error('Chain Id not supported');
          } else {
            const {
              chainId,
              rpcUrls: [rpcUrl],
              nativeCurrency: { name, symbol, decimals },
              blockExplorerUrls: [blockExplorerUrl],
            } = proposedChain;

            // Validate chain Id
            if (!isHex(chainId)) {
              throw new Error(
                `Expected 0x-prefixed, unpadded, non-zero hexadecimal string "chainId". Received: ${chainId}`,
              );
            } else if (Number(chainId) > Number.MAX_SAFE_INTEGER) {
              throw new Error(
                `Invalid chain ID "${chainId}": numerical value greater than max safe value. Received: ${chainId}`,
              );
              // Validate symbol and name
            } else if (!rpcUrl) {
              throw new Error(
                `Expected non-empty array[string] "rpcUrls". Received: ${rpcUrl}`,
              );
            } else if (!name || !symbol) {
              throw new Error(
                'Expected non-empty string "nativeCurrency.name", "nativeCurrency.symbol"',
              );
              // Validate decimals
            } else if (
              !Number.isInteger(decimals) ||
              decimals < 0 ||
              decimals > 36
            ) {
              throw new Error(
                `Expected non-negative integer "nativeCurrency.decimals" less than 37. Received: ${decimals}`,
              );
              // Validate symbol length
            } else if (symbol.length < 2 || symbol.length > 6) {
              throw new Error(
                `Expected 2-6 character string 'nativeCurrency.symbol'. Received: ${symbol}`,
              );
              // Validate symbol against existing chains
            } else if (isSupportedChain?.(Number(chainId))) {
              const knownChain = getChain(Number(chainId));
              if (knownChain?.nativeCurrency.symbol !== symbol) {
                throw new Error(
                  `nativeCurrency.symbol does not match currency symbol for a network the user already has added with the same chainId. Received: ${symbol}`,
                );
              }
              // Validate blockExplorerUrl
            } else if (!blockExplorerUrl) {
              throw new Error(
                `Expected null or array with at least one valid string HTTPS URL 'blockExplorerUrl'. Received: ${blockExplorerUrl}`,
              );
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
              throw new Error('User rejected the request.');
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
          if (!supportedChainId || !activeSession) {
            onSwitchEthereumChainNotSupported?.({
              proposedChain,
              callbackOptions: meta,
            });
            throw new Error('Chain Id not supported');
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
              throw new Error('Method supported only for ERC20');
            }

            if (!address) {
              throw new Error('Address is required');
            }

            let chainId = null;
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
            throw new Error('Method not supported');
          }
        }
      }
      return { id, result: response };
    } catch (error) {
      return { id, error: <Error>error };
    }
  });
