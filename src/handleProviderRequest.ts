import { Provider, TransactionRequest } from '@ethersproject/providers';
import {
  Address,
  IMessenger,
  IProviderRequestTransport,
  ProviderRequestPayload,
} from './references';
import { toHex } from './utils/hex';
import { getDappHost, isValidUrl } from './utils/apps';

export type ActiveSession = { address: Address; chainId: number } | null;

export const handleProviderRequest = ({
  providerRequestTransport,
  getProvider,
  getActiveSession,
}: {
  popupMessenger: IMessenger;
  inpageMessenger: IMessenger;
  providerRequestTransport: IProviderRequestTransport;
  getProvider: (options: { chainId?: number }) => Provider;
  getActiveSession: ({ host }: { host: string }) => ActiveSession;
  messengerProviderRequest: (
    messenger: IMessenger,
    request: ProviderRequestPayload,
  ) => Promise<object>;
}) =>
  providerRequestTransport?.reply(async ({ method, id, params }, meta) => {
    try {
      const url = meta?.sender?.url || '';
      const host = (isValidUrl(url) && getDappHost(url)) || '';
      const activeSession = getActiveSession({ host });

      let response = null;

      switch (method) {
        case 'eth_chainId':
        case 'eth_coinbase':
        case 'eth_accounts':
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
          const {
            gasLimit,
            gasPrice,
            maxFeePerGas,
            maxPriorityFeePerGas,
            value,
          } = transaction;
          response = {
            ...transaction,
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
        case 'eth_signTypedData_v4':
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
