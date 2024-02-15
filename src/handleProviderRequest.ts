import {
  IMessenger,
  IProviderRequestTransport,
  ProviderRequestPayload,
} from './references';

export const handleProviderRequest = ({
  providerRequestTransport,
}: {
  popupMessenger: IMessenger;
  inpageMessenger: IMessenger;
  providerRequestTransport: IProviderRequestTransport;
  messengerProviderRequest: (
    messenger: IMessenger,
    request: ProviderRequestPayload,
  ) => Promise<object>;
}) =>
  providerRequestTransport?.reply(async ({ method, id }) => {
    try {
      const response = null;
      switch (method) {
        case 'eth_chainId':
        case 'eth_coinbase':
        case 'eth_accounts':
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
        case 'eth_blockNumber':
        case 'eth_getBalance':
        case 'eth_call':
        case 'eth_estimateGas':
        case 'eth_gasPrice':
        case 'eth_getCode':
        case 'personal_ecRecover':
        default:
      }
      return { id, result: response };
    } catch (error) {
      return { id, error: <Error>error };
    }
  });
