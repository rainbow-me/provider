import { EventEmitter } from 'eventemitter3';

type ChainIdHex = `0x${string}`;
type Address = `0x${string}`;

enum rpcMethods {
  eth_chainId = 'eth_chainId',
  eth_accounts = 'eth_accounts',
  eth_sendTransaction = 'eth_sendTransaction',
  eth_signTransaction = 'eth_signTransaction',
  personal_sign = 'personal_sign',
  eth_signTypedData = 'eth_signTypedData',
  eth_signTypedData_v3 = 'eth_signTypedData_v3',
  eth_signTypedData_v4 = 'eth_signTypedData_v4',
  eth_getCode = 'eth_getCode',
  wallet_addEthereumChain = 'wallet_addEthereumChain',
  wallet_switchEthereumChain = 'wallet_switchEthereumChain',
  eth_requestAccounts = 'eth_requestAccounts',
  eth_blockNumber = 'eth_blockNumber',
  eth_call = 'eth_call',
  eth_estimateGas = 'eth_estimateGas',
  personal_ecRecover = 'personal_ecRecover',
  eth_gasPrice = 'eth_gasPrice',
  eth_getBlockByNumber = 'eth_getBlockByNumber',
  eth_getBalance = 'eth_getBalance',
  eth_getTransactionByHash = 'eth_getTransactionByHash',
}

type RPCMethod = keyof typeof rpcMethods | string;

type RequestArguments = {
  id?: number;
  method: RPCMethod;
  params?: Array<unknown>;
};
type RequestResponse =
  | {
      id: number;
      error: Error;
      result?: never;
    }
  | {
      id: number;
      error?: never;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result: any;
    };

type AddEthereumChainParameter = {
  /** A 0x-prefixed hexadecimal string */
  chainId: string;
  chainName: string;
  nativeCurrency?: {
    name: string;
    /** 2-6 characters long */
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
  /** Currently ignored. */
  iconUrls?: string[];
};
type WalletPermissionCaveat = {
  type: string;
  value: unknown;
};
type WalletPermission = {
  caveats: WalletPermissionCaveat[];
  date: number;
  id: string;
  invoker: `http://${string}` | `https://${string}`;
  parentCapability: 'eth_accounts' | string;
};
type WatchAssetParams = {
  /** In the future, other standards will be supported */
  type: 'ERC20';
  options: {
    /** Address of token contract */
    address: Address;
    /** Number of token decimals */
    decimals: number;
    /** String url of token logo */
    image?: string;
    /** A ticker symbol or shorthand, up to 5 characters */
    symbol: string;
  };
};

interface Ethereum {
  on?: (...args: unknown[]) => void;
  removeListener?: (...args: unknown[]) => void;
  providers?: Ethereum[];
  /**
   * EIP-747: Add wallet_watchAsset to Provider
   * https://eips.ethereum.org/EIPS/eip-747
   */
  request(args: {
    method: 'wallet_watchAsset';
    params: WatchAssetParams;
  }): Promise<boolean>;
  /**
   * EIP-1193: Ethereum Provider JavaScript API
   * https://eips.ethereum.org/EIPS/eip-1193
   */
  request(args: { method: 'eth_accounts' }): Promise<Address[]>;
  request(args: { method: 'eth_chainId' }): Promise<string>;
  request(args: { method: 'eth_requestAccounts' }): Promise<Address[]>;
  /**
   * EIP-1474: Remote procedure call specification
   * https://eips.ethereum.org/EIPS/eip-1474
   */
  request(args: { method: 'web3_clientVersion' }): Promise<string>;
  /**
   * EIP-2255: Wallet Permissions System
   * https://eips.ethereum.org/EIPS/eip-2255
   */
  request(args: {
    method: 'wallet_requestPermissions';
    params: [
      {
        eth_accounts: Record<string, unknown>;
      },
    ];
  }): Promise<WalletPermission[]>;
  request(args: {
    method: 'wallet_getPermissions';
  }): Promise<WalletPermission[]>;
  /**
   * EIP-3085: Wallet Add Ethereum Chain RPC Method
   * https://eips.ethereum.org/EIPS/eip-3085
   */
  request(args: {
    method: 'wallet_addEthereumChain';
    params: AddEthereumChainParameter[];
  }): Promise<null>;
  /**
   * EIP-3326: Wallet Switch Ethereum Chain RPC Method
   * https://eips.ethereum.org/EIPS/eip-3326
   */
  request(args: {
    method: 'wallet_switchEthereumChain';
    params: [
      {
        chainId: string;
      },
    ];
  }): Promise<null>;
}

type CallbackOptions = {
  /** The sender of the message. */
  sender: chrome.runtime.MessageSender;
  /** The topic provided. */
  topic: string;
  /** An optional scoped identifier. */
  id?: number | string;
};

type CallbackFunction<TPayload, TResponse> = (
  payload: TPayload,
  callbackOptions: CallbackOptions,
) => Promise<TResponse>;

interface IMessenger {
  /** Whether or not the messenger is available in the context. */
  available: boolean;
  /** Name of the messenger */
  name: string;
  /** Sends a message to the `reply` handler. */
  send: <TPayload, TResponse>(
    /** A scoped topic that the `reply` will listen for. */
    topic: string,
    /** The payload to send to the `reply` handler. */
    payload: TPayload,
    options?: {
      /** Identify & scope the request via an ID. */
      id?: string | number;
    },
  ) => Promise<TResponse>;
  /** Replies to `send`. */
  reply: <TPayload, TResponse>(
    /** A scoped topic that was sent from `send`. */
    topic: string,
    callback: CallbackFunction<TPayload, TResponse>,
  ) => () => void;
}

// IProviderRequestTransport.ts
interface IProviderRequestTransport {
  send(request: RequestArguments, context?: unknown): Promise<RequestResponse>;
  // ... additional methods and properties as needed
}

export class RainbowProvider extends EventEmitter {
  chainId: ChainIdHex = '0x1';
  connected = false;
  isRainbow = true;
  isReady = true;
  isMetaMask = true;
  networkVersion = '1';
  selectedAddress: string | undefined;
  providers: (RainbowProvider | Ethereum)[] | undefined = undefined;

  #isUnlocked = true;
  requestId = 0;
  rainbowIsDefaultProvider = false;

  private backgroundMessenger?: IMessenger;
  private messenger?: IMessenger;
  private providerRequestTransport?: IProviderRequestTransport;

  [key: string]: unknown;

  constructor({
    messenger,
    backgroundMessenger,
    providerRequestTransport,
    onConstruct,
  }: {
    messenger?: IMessenger;
    backgroundMessenger?: IMessenger;
    providerRequestTransport?: IProviderRequestTransport;
    onConstruct?: ({
      emit,
    }: {
      emit: (event: string, ...args: unknown[]) => void;
    }) => void;
  }) {
    super();
    this.messenger = messenger;
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
    }
    return response.result;
  }

  /** @deprecated – This method is deprecated in favor of `request`. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sendAsync(args: RequestArguments) {
    return this.request(args);
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
