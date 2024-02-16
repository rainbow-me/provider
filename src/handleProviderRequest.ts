import { Provider, TransactionRequest } from '@ethersproject/providers';
import {
  Address,
  IMessenger,
  IProviderRequestTransport,
  ProviderRequestPayload,
} from './references';
import { toHex } from './utils/hex';
import { getDappHost, isValidUrl } from './utils/apps';
import { normalizeTransactionResponsePayload } from './utils/ethereum';
import { isAddress } from '@ethersproject/address';

export type ActiveSession = { address: Address; chainId: number } | null;

export const handleProviderRequest = ({
  providerRequestTransport,
  getProvider,
  getActiveSession,
  messengerProviderRequest,
}: {
  popupMessenger: IMessenger;
  inpageMessenger: IMessenger;
  providerRequestTransport: IProviderRequestTransport;
  messengerProviderRequest: (
    request: ProviderRequestPayload,
  ) => Promise<object>;
  getProvider: (options: { chainId?: number }) => Provider;
  getActiveSession: ({ host }: { host: string }) => ActiveSession;
}) =>
  providerRequestTransport?.reply(async ({ method, id, params }, meta) => {
    try {
      const url = meta?.sender?.url || '';
      const host = (isValidUrl(url) && getDappHost(url)) || '';
      const activeSession = getActiveSession({ host });

      let response = null;

      switch (method) {
        case 'eth_chainId': {
          response = activeSession
            ? toHex(String(activeSession.chainId))
            : '0x1';
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
          response = toHex(String(blockNumber));
          break;
        }
        case 'eth_getBalance': {
          const provider = getProvider({ chainId: activeSession?.chainId });
          const balance = await provider.getBalance(params?.[0] as string);
          response = toHex(balance.toString());
          break;
        }
        case 'eth_getTransactionByHash': {
          const provider = getProvider({ chainId: activeSession?.chainId });
          const transaction = await provider.getTransaction(
            params?.[0] as string,
          );
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
            gasLimit: toHex(gasLimit.toString()),
            gasPrice: gasPrice ? toHex(gasPrice.toString()) : undefined,
            maxFeePerGas: maxFeePerGas
              ? toHex(maxFeePerGas.toString())
              : undefined,
            maxPriorityFeePerGas: maxPriorityFeePerGas
              ? toHex(maxPriorityFeePerGas.toString())
              : undefined,
            value: toHex(value.toString()),
          };
          break;
        }
        case 'eth_call': {
          const provider = getProvider({ chainId: activeSession?.chainId });
          response = await provider.call(params?.[0] as TransactionRequest);
          break;
        }
        case 'eth_estimateGas': {
          const provider = getProvider({ chainId: activeSession?.chainId });
          const gas = await provider.estimateGas(
            params?.[0] as TransactionRequest,
          );
          response = toHex(gas.toString());
          break;
        }
        case 'eth_gasPrice': {
          const provider = getProvider({ chainId: activeSession?.chainId });
          const gasPrice = await provider.getGasPrice();
          response = toHex(gasPrice.toString());
          break;
        }
        case 'eth_getCode': {
          const provider = getProvider({ chainId: activeSession?.chainId });
          response = await provider.getCode(
            params?.[0] as string,
            params?.[1] as string,
          );
          break;
        }
        case 'eth_sendTransaction':
        case 'eth_signTransaction':
        case 'personal_sign':
        case 'eth_signTypedData':
        case 'eth_signTypedData_v3':
        case 'eth_signTypedData_v4': {
          // If we need to validate the input before showing the UI, it should go here.
          if (method === 'eth_signTypedData_v4') {
            // we don't trust the params order
            let dataParam = params?.[1];
            if (!isAddress(params?.[0] as Address)) {
              dataParam = params?.[0];
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
        case 'wallet_addEthereumChain':
        case 'wallet_watchAsset':
        case 'wallet_switchEthereumChain':
        case 'eth_requestAccounts':
        case 'personal_ecRecover':
        default:
      }
      return { id, result: response };
    } catch (error) {
      return { id, error: <Error>error };
    }
  });
