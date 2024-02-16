export type ChainIdHex = `0x${string}`;
export type Address = `0x${string}`;

export enum rpcMethods {
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

export type RPCMethod = keyof typeof rpcMethods | string;

export type RequestArguments = {
  id?: number;
  method: RPCMethod;
  params?: Array<unknown>;
};

export type RequestResponse =
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

export type AddEthereumChainParameter = {
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

export type WalletPermissionCaveat = {
  type: string;
  value: unknown;
};

export type WalletPermission = {
  caveats: WalletPermissionCaveat[];
  date: number;
  id: string;
  invoker: `http://${string}` | `https://${string}`;
  parentCapability: 'eth_accounts' | string;
};

export type WatchAssetParams = {
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

export interface Ethereum {
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

export interface Tab {
  /**
   * Optional.
   * The title of the tab. This property is only present if the extension's manifest includes the "tabs" permission.
   */
  title?: string | undefined;
  /**
   * Optional.
   * The ID of the tab. Tab IDs are unique within a browser session. Under some circumstances a Tab may not be assigned an ID, for example when querying foreign tabs using the sessions API, in which case a session ID may be present. Tab ID can also be set to chrome.tabs.TAB_ID_NONE for apps and devtools windows.
   */
  id?: number | undefined;
}

export interface IMessageSender {
  /**
   * The URL of the page or frame that opened the connection. If the sender is in an iframe, it will be iframe's URL not the URL of the page which hosts it.
   * @since Chrome 28.
   */
  url?: string | undefined;
  /** The tabs.Tab which opened the connection, if any. This property will only be present when the connection was opened from a tab (including content scripts), and only if the receiver is an extension, not an app. */
  tab?: Tab | undefined;
}

export type CallbackOptions = {
  /** The sender of the message. */
  sender: IMessageSender;
  /** The topic provided. */
  topic: string;
  /** An optional scoped identifier. */
  id?: number | string;
};

type CallbackFunction<TPayload, TResponse> = (
  payload: TPayload,
  callbackOptions: CallbackOptions,
) => Promise<TResponse>;

export interface IMessenger {
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

export type ProviderRequestPayload = RequestArguments & {
  id: number;
  meta?: CallbackOptions;
};
type ProviderResponse = RequestResponse;

export interface IProviderRequestTransport {
  send(
    payload: ProviderRequestPayload,
    {
      id,
    }: {
      id: number;
    },
  ): Promise<ProviderResponse>;
  reply(
    callback: (
      payload: ProviderRequestPayload,
      callbackOptions: CallbackOptions,
    ) => Promise<ProviderResponse>,
  ): Promise<void>;
}
