import { EventEmitter } from 'eventemitter3';
import { ChainIdHex, Ethereum, RPCMethod } from './references/ethereum';
import {
  IMessenger,
  IProviderRequestTransport,
  RequestArguments,
  RequestError,
  RequestResponse,
} from './references/messengers';
import { toHex } from './utils/hex';

export class RainbowProvider extends EventEmitter {
  chainId: ChainIdHex | undefined;
  connected = false;
  isRainbow = true;
  isReady = true;
  isMetaMask = true;
  networkVersion = '1';
  selectedAddress: string | undefined;
  providers: (RainbowProvider | Ethereum)[] | undefined = undefined;

  requestId = 0;

  private backgroundMessenger?: IMessenger;
  private providerRequestTransport?: IProviderRequestTransport;

  [key: string]: unknown;

  constructor({
    backgroundMessenger,
    providerRequestTransport,
    onConstruct,
  }:
    | {
        backgroundMessenger?: IMessenger;
        providerRequestTransport?: IProviderRequestTransport;
        onConstruct?: ({
          emit,
        }: {
          emit: (event: string, ...args: unknown[]) => void;
        }) => void;
      }
    | undefined = {}) {
    super();
    this.backgroundMessenger = backgroundMessenger;
    this.providerRequestTransport = providerRequestTransport;
    onConstruct?.({ emit: this.emit.bind(this) });

    // EIP-6963 RainbowInjectedProvider in announceProvider was losing context
    this.bindMethods();
  }

  bindMethods() {
    for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
      const value = this[key];
      if (typeof value === 'function' && key !== 'constructor') {
        this[key] = value.bind(this);
      }
    }
  }

  /**
   * @deprecated – This method is deprecated in favor of the RPC method `eth_requestAccounts`.
   * @link https://eips.ethereum.org/EIPS/eip-1102#providerenable-deprecated
   **/
  async enable() {
    return this.request({ method: 'eth_requestAccounts' });
  }

  isConnected() {
    return this.connected;
  }

  async handleChainChanged(chainId: ChainIdHex) {
    this.chainId = chainId;
    this.networkVersion = parseInt(this.chainId, 16).toString();
    this.emit('chainChanged', toHex(String(chainId)));
  }

  async request({
    method,
    params,
  }: RequestArguments): Promise<RequestResponse | undefined> {
    if (!this.providerRequestTransport) throw new Error('No transport');
    this.backgroundMessenger?.send(
      'rainbow_prefetchDappMetadata',
      window.location.href,
    );
    // eslint-disable-next-line no-plusplus
    const id = this.requestId++;
    const response = await this.providerRequestTransport?.send(
      {
        id,
        method,
        params,
      },
      { id },
    );

    if (response.id !== id) return;
    if (response.error) throw response.error;

    switch (method) {
      case 'eth_requestAccounts':
        this.selectedAddress = response.result[0];
        this.connected = true;
        break;
      case 'eth_chainId':
        this.chainId = <ChainIdHex>response.result;
        this.networkVersion = parseInt(this.chainId, 16).toString();
        break;
      default:
        break;
    }

    return response.result;
  }

  /** @deprecated – This method is deprecated in favor of `request`. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sendAsync(
    args: RequestArguments,
    callback: (error: RequestError | null, response: RequestResponse) => void,
  ) {
    try {
      const result = await this.request(args);
      callback(null, {
        id: args.id!,
        jsonrpc: '2.0',
        result,
      });
    } catch (error: unknown) {
      callback(error as Error, {
        id: args.id!,
        jsonrpc: '2.0',
        error: {
          code: (error as RequestError).code,
          message: (error as RequestError).message,
          name: (error as RequestError).name,
        },
      });
    }
  }

  /** @deprecated – This method is deprecated in favor of `request`. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async send(
    methodOrPayload: string | RequestArguments,
    paramsOrCallback: Array<unknown>,
  ) {
    if (
      typeof methodOrPayload === 'string' &&
      Array.isArray(paramsOrCallback)
    ) {
      return this.request({
        method: methodOrPayload as RPCMethod,
        params: paramsOrCallback,
      });
    } else {
      return this.request(methodOrPayload as RequestArguments);
    }
  }
}
