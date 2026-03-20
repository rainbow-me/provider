import { describe, it, vi, expect, beforeAll, beforeEach, Mock } from 'vitest';
import {
  handleProviderRequest,
  createProviderError,
} from './handleProviderRequest';
import { Messenger, createTransport } from './utils/tests';
import {
  ProviderRequestPayload,
  RequestResponse,
} from './references/messengers';
import { type Address, isHex, toHex } from 'viem';
import { mainnet, optimism } from 'viem/chains';
import { StaticJsonRpcProvider } from '@ethersproject/providers';

const TESTMAR27_ETH_ADDRESS: Address =
  '0x5e087b61aad29559e31565079fcdabe384b44614';
const RAINBOWWALLET_ETH_ADDRESS: Address =
  '0x7a3d05c70581bd345fe117c06e45f9669205384f';
const RAINBOWWALLET_ETH_TX_HASH =
  '0xfc621a4577ba3398adc0800400b2ba2c408ab76cdc1521dadbfc802dc93a8b37';
const TX_HASH =
  '0x43cfbb52ec99192e96f34a42b37354cfabd6845403e9473e921030da9751d12d';
const SIGN_SIGNATURE = '0x123456789';

const TYPED_MESSAGE = {
  domain: {
    chainId: 1,
    name: 'Ether Mail',
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
    version: '1',
  },
  types: {
    Mail: [
      { name: 'from', type: 'Person' },
      { name: 'to', type: 'Person' },
      { name: 'contents', type: 'string' },
    ],
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' },
    ],
  },
  value: {
    contents: 'Hello, Bob!',
    from: {
      name: 'Cow',
      wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
    },
    to: {
      name: 'Bob',
      wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    },
  },
};

describe('handleProviderRequest', () => {
  const getFeatureFlagsMock = vi.fn(() => ({ custom_rpc: true }));
  const checkRateLimitMock: Mock = vi.fn(() => Promise.resolve(undefined));
  const getSupportedChainIdsMock = vi.fn(() => [mainnet.id, optimism.id]);
  const getActiveSessionMock = vi.fn(({ host }: { host: string }) => {
    switch (host) {
      case 'dapp1.com': {
        return {
          address: RAINBOWWALLET_ETH_ADDRESS,
          chainId: mainnet.id,
        };
      }
      case 'dapp2.com':
      default: {
        return {
          address: TESTMAR27_ETH_ADDRESS,
          chainId: optimism.id,
        };
      }
    }
  });
  const getChainNativeCurrencyMock = vi.fn((chainId: number) => {
    switch (chainId) {
      case 1:
      default:
        return mainnet.nativeCurrency;
    }
  });
  const getProviderMock = vi.fn(({ chainId }: { chainId?: number }) => {
    switch (chainId) {
      case 1:
      default:
        return new StaticJsonRpcProvider('http://127.0.0.1:8545');
    }
  });
  const messengerProviderRequestMock = vi.fn((payload) => {
    // This is just passing messages so we can test the responses
    switch (payload.method) {
      case 'eth_requestAccounts': {
        return Promise.resolve(RAINBOWWALLET_ETH_ADDRESS);
      }
      case 'eth_sendTransaction': {
        return Promise.resolve(TX_HASH);
      }
      case 'personal_sign': {
        return Promise.resolve(
          SIGN_SIGNATURE + 'personal_sign' + payload.params[0],
        );
      }
      case 'eth_signTypedData': {
        return Promise.resolve(
          SIGN_SIGNATURE + 'eth_signTypedData' + payload.params[0],
        );
      }
      case 'eth_signTypedData_v3': {
        return Promise.resolve(
          SIGN_SIGNATURE + 'eth_signTypedData_v3' + payload.params[0],
        );
      }
      case 'eth_signTypedData_v4': {
        return Promise.resolve(
          SIGN_SIGNATURE + 'eth_signTypedData_v4' + payload.params[0],
        );
      }
      case 'wallet_addEthereumChain': {
        return Promise.resolve(true);
      }
      case 'wallet_switchEthereumChain': {
        return Promise.resolve(true);
      }
      case 'wallet_watchAsset': {
        return Promise.resolve(true);
      }
      default: {
        return Promise.resolve({});
      }
    }
  });
  const onAddEthereumChainMock = vi.fn(() => ({ chainAlreadyAdded: false }));
  const onSwitchEthereumChainNotSupportedMock = vi.fn(() => null);
  const onSwitchEthereumChainSupportedMock = vi.fn(() => null);

  const messenger = new Messenger('test');
  const transport = createTransport<ProviderRequestPayload, RequestResponse>({
    messenger,
    topic: 'providerRequest',
  });

  beforeAll(() => {
    handleProviderRequest({
      providerRequestTransport: transport,
      getFeatureFlags: getFeatureFlagsMock,
      checkRateLimit: checkRateLimitMock,
      getSupportedChainIds: getSupportedChainIdsMock,
      getActiveSession: getActiveSessionMock,
      getChainNativeCurrency: getChainNativeCurrencyMock,
      getProvider: getProviderMock,
      messengerProviderRequest: messengerProviderRequestMock,
      onAddEthereumChain: onAddEthereumChainMock,
      onSwitchEthereumChainNotSupported: onSwitchEthereumChainNotSupportedMock,
      onSwitchEthereumChainSupported: onSwitchEthereumChainSupportedMock,
    });
  });

  it('should rate limit requests', async () => {
    checkRateLimitMock.mockImplementationOnce(() => Promise.resolve(true));
    const response = await transport.send(
      { id: 1, method: 'eth_requestAccounts' },
      { id: 1 },
    );
    expect(response).toEqual({
      id: 1,
      error: {
        code: -32005,
        message: 'Rate Limit Exceeded',
        name: 'Limit exceeded',
      },
    });
  });

  it('should call eth_chainId correctly', async () => {
    const response = await transport.send(
      {
        id: 1,
        method: 'eth_chainId',
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(Number(response.result)).toEqual(mainnet.id);
  });

  it('should call eth_coinbase correctly', async () => {
    const response1 = await transport.send(
      {
        id: 1,
        method: 'eth_coinbase',
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(response1.result).toEqual(RAINBOWWALLET_ETH_ADDRESS);
    const response2 = await transport.send(
      {
        id: 2,
        method: 'eth_coinbase',
        meta: {
          sender: { url: 'https://dapp2.com' },
          topic: 'providerRequest',
        },
      },
      { id: 2 },
    );
    expect(response2.result).toEqual(TESTMAR27_ETH_ADDRESS);
  });

  it('should call eth_accounts correctly', async () => {
    const response1 = await transport.send(
      {
        id: 1,
        method: 'eth_accounts',
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(response1.result).toEqual([RAINBOWWALLET_ETH_ADDRESS]);
    const response2 = await transport.send(
      {
        id: 2,
        method: 'eth_accounts',
        meta: {
          sender: { url: 'https://dapp2.com' },
          topic: 'providerRequest',
        },
      },
      { id: 2 },
    );
    expect(response2.result).toEqual([TESTMAR27_ETH_ADDRESS]);
  });

  it('should call eth_blockNumber correctly', async () => {
    const response = await transport.send(
      {
        id: 1,
        method: 'eth_blockNumber',
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(isHex(response.result)).toBeTruthy();
  });

  it('should call eth_getBalance correctly', async () => {
    const response = await transport.send(
      {
        id: 1,
        method: 'eth_getBalance',
        params: [RAINBOWWALLET_ETH_ADDRESS],
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(isHex(response.result)).toBeTruthy();
  });

  it('should call eth_getTransactionByHash correctly', async () => {
    const response = await transport.send(
      {
        id: 1,
        method: 'eth_getTransactionByHash',
        params: [RAINBOWWALLET_ETH_TX_HASH],
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(isHex(response.result.data)).toBeTruthy();
  });

  it('should call eth_call correctly', async () => {
    const response = await transport.send(
      {
        id: 1,
        method: 'eth_call',
        params: [
          {
            from: null,
            to: '0x6b175474e89094c44da98b954eedeac495271d0f',
            data: '0x70a082310000000000000000000000006E0d01A76C3Cf4288372a29124A26D4353EE51BE',
          },
          'latest',
        ],
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(isHex(response.result)).toBeTruthy();
  });

  it('should call eth_estimateGas correctly', async () => {
    const response = await transport.send(
      {
        id: 1,
        method: 'eth_estimateGas',
        params: [
          {
            from: '0x8D97689C9818892B700e27F316cc3E41e17fBeb9',
            to: '0xd3CdA913deB6f67967B99D67aCDFa1712C293601',
            value: '0x186a0',
          },
        ],
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(isHex(response.result)).toBeTruthy();
  });

  it('should call eth_gasPrice correctly', async () => {
    const response = await transport.send(
      {
        id: 1,
        method: 'eth_gasPrice',
        params: [],
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(isHex(response.result)).toBeTruthy();
  });

  it('should call eth_getCode correctly', async () => {
    const response = await transport.send(
      {
        id: 1,
        method: 'eth_getCode',
        params: ['0x5B56438000bAc5ed2c6E0c1EcFF4354aBfFaf889', 'latest'],
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(isHex(response.result)).toBeTruthy();
  });

  it('should call eth_requestAccounts correctly', async () => {
    const response = await transport.send(
      {
        id: 1,
        method: 'eth_requestAccounts',
        params: [],
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(response.result[0]).toBe(RAINBOWWALLET_ETH_ADDRESS);
  });

  it('should call eth_sendTransaction correctly', async () => {
    const response = await transport.send(
      {
        id: 1,
        method: 'eth_sendTransaction',
        params: [
          {
            from: '0x5B570F0F8E2a29B7bCBbfC000f9C7b78D45b7C35',
            gas: '0x5208',
            to: '0x5B570F0F8E2a29B7bCBbfC000f9C7b78D45b7C35',
            value: '0x9184e72a000',
          },
        ],
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(response.result).toBe(TX_HASH);
  });

  it('should call personal_sign correctly', async () => {
    const response = await transport.send(
      {
        id: 1,
        method: 'personal_sign',
        params: ['personal_sign_message'],
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(response.result).toBe(
      SIGN_SIGNATURE + 'personal_sign' + 'personal_sign_message',
    );
  });

  it('should call eth_signTypedData correctly', async () => {
    const response = await transport.send(
      {
        id: 1,
        method: 'eth_signTypedData',
        params: ['eth_signTypedData_message'],
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(response.result).toBe(
      SIGN_SIGNATURE + 'eth_signTypedData' + 'eth_signTypedData_message',
    );
  });

  it('should call eth_signTypedData_v3 correctly', async () => {
    const response = await transport.send(
      {
        id: 1,
        method: 'eth_signTypedData_v3',
        params: ['eth_signTypedData_v3_message'],
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(response.result).toBe(
      SIGN_SIGNATURE + 'eth_signTypedData_v3' + 'eth_signTypedData_v3_message',
    );
  });

  it('should call eth_signTypedData_v4 correctly', async () => {
    const response = await transport.send(
      {
        id: 1,
        method: 'eth_signTypedData_v4',
        params: [TYPED_MESSAGE],
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(response.result).toBe(
      SIGN_SIGNATURE + 'eth_signTypedData_v4' + TYPED_MESSAGE,
    );
  });

  it('should call wallet_addEthereumChain correctly', async () => {
    const response = await transport.send(
      {
        id: 1,
        method: 'wallet_addEthereumChain',
        params: [
          {
            blockExplorerUrls: [mainnet.blockExplorers.default.url],
            chainId: toHex(mainnet.id),
            chainName: mainnet.network,
            nativeCurrency: mainnet.nativeCurrency,
            rpcUrls: [mainnet.rpcUrls.default.http],
          },
          RAINBOWWALLET_ETH_ADDRESS,
        ],
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(response.result).toBeNull();
  });

  it('should call wallet_switchEthereumChain correctly', async () => {
    const response = await transport.send(
      {
        id: 1,
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: toHex(mainnet.id) }],
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(response.result).toBeNull();
  });

  it('should call wallet_watchAsset correctly', async () => {
    const response = await transport.send(
      {
        id: 1,
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: '0xb60e8dd61c5d32be8058bb8eb970870f07233155',
            symbol: 'FOO',
            decimals: 18,
            image: 'https://foo.io/token-image.svg',
          },
        } as unknown as Array<unknown>,
        meta: {
          sender: { url: 'https://dapp1.com' },
          topic: 'providerRequest',
        },
      },
      { id: 1 },
    );
    expect(response.result).toBeTruthy();
  });
});

describe('handleProviderRequest - error passthrough', () => {
  const getFeatureFlagsMock = vi.fn(() => ({ custom_rpc: true }));
  const checkRateLimitMock: Mock = vi.fn(() => Promise.resolve(undefined));
  const getSupportedChainIdsMock = vi.fn(() => [mainnet.id, optimism.id]);
  const getActiveSessionMock = vi.fn(() => ({
    address: RAINBOWWALLET_ETH_ADDRESS,
    chainId: mainnet.id,
  }));
  const getChainNativeCurrencyMock = vi.fn(() => mainnet.nativeCurrency);
  const getProviderMock = vi.fn(
    () => new StaticJsonRpcProvider('http://127.0.0.1:8545'),
  );

  const getCapabilitiesMock = vi.fn();
  const getBatchByKeyMock = vi.fn();
  const setBatchMock = vi.fn();
  const showCallsStatusMock = vi.fn();
  const messengerProviderRequestMock = vi.fn();

  const messenger = new Messenger('test-passthrough');
  const transport = createTransport<ProviderRequestPayload, RequestResponse>({
    messenger,
    topic: 'providerRequest',
  });

  const meta = {
    sender: { url: 'https://dapp1.com' },
    topic: 'providerRequest',
  };

  const sendPayload = (
    id: number,
    method: string,
    params: readonly unknown[] = [],
  ) =>
    transport.send(
      { id, method, params: [...params], meta } as ProviderRequestPayload,
      { id },
    );

  beforeAll(() => {
    handleProviderRequest({
      providerRequestTransport: transport,
      getFeatureFlags: getFeatureFlagsMock,
      checkRateLimit: checkRateLimitMock,
      getSupportedChainIds: getSupportedChainIdsMock,
      getActiveSession: getActiveSessionMock,
      getChainNativeCurrency: getChainNativeCurrencyMock,
      getProvider: getProviderMock,
      messengerProviderRequest: messengerProviderRequestMock,
      onAddEthereumChain: vi.fn(() => ({ chainAlreadyAdded: false })),
      onSwitchEthereumChainNotSupported: vi.fn(),
      onSwitchEthereumChainSupported: vi.fn(),
      getCapabilities: getCapabilitiesMock,
      getBatchByKey: getBatchByKeyMock,
      setBatch: setBatchMock,
      showCallsStatus: showCallsStatusMock,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    messengerProviderRequestMock.mockResolvedValue({ id: '0x123' });
    getCapabilitiesMock.mockResolvedValue({
      [mainnet.id]: { atomic: { status: 'supported' } },
      [optimism.id]: { atomic: { status: 'supported' } },
    });
    getBatchByKeyMock.mockResolvedValue(undefined);
    setBatchMock.mockImplementation(() => {});
  });

  describe('createProviderError', () => {
    it('creates error with code and name for passthrough', () => {
      const err = createProviderError(
        'METHOD_NOT_SUPPORTED',
        'Feature disabled',
      );
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Feature disabled');
      expect(err.code).toBe(-32004);
      expect(err.name).toBe('Method not supported');
    });

    it('uses errorCode.name when message omitted', () => {
      const err = createProviderError('METHOD_NOT_SUPPORTED');
      expect(err.message).toBe('Method not supported');
    });
  });

  const EIP5792_METHODS = [
    {
      method: 'wallet_getCapabilities',
      params: [RAINBOWWALLET_ETH_ADDRESS],
      setupThrow: (err: Error) => {
        getCapabilitiesMock.mockRejectedValueOnce(err);
      },
    },
    {
      method: 'wallet_getCallsStatus',
      params: ['0x' + 'a'.repeat(64)],
      setupThrow: (err: Error) => {
        getBatchByKeyMock.mockRejectedValueOnce(err);
      },
    },
    {
      method: 'wallet_sendCalls',
      params: [
        {
          version: '2.0.0',
          chainId: toHex(mainnet.id),
          from: RAINBOWWALLET_ETH_ADDRESS,
          atomicRequired: false,
          calls: [{ to: RAINBOWWALLET_ETH_ADDRESS as Address, value: 0n }],
        },
      ],
      setupThrow: (err: Error) => {
        setBatchMock.mockImplementationOnce(() => {
          throw err;
        });
      },
    },
    {
      method: 'wallet_showCallsStatus',
      params: ['0x' + 'b'.repeat(64)],
      setupThrow: (err: Error) => {
        getBatchByKeyMock.mockResolvedValueOnce({
          id: '0x' + 'b'.repeat(64),
          chainId: mainnet.id,
          status: 200,
          atomic: false,
          txHashes: [TX_HASH],
        });
        showCallsStatusMock.mockRejectedValueOnce(err);
      },
    },
  ] as const;

  describe('pass-through errors', () => {
    it.each(EIP5792_METHODS)(
      'passes through $method when implementation throws createProviderError',
      async ({ method, params, setupThrow }) => {
        const passthroughError = createProviderError(
          'METHOD_NOT_SUPPORTED',
          'Method not supported',
        );
        setupThrow(passthroughError);

        const response = await sendPayload(1, method, params);

        expect(response).toHaveProperty('error');
        expect(response.error).toEqual({
          code: -32004,
          name: 'Method not supported',
          message: 'Method not supported',
        });
      },
    );

    it.each(EIP5792_METHODS)(
      'passes through $method when implementation throws object with code/name',
      async ({ method, params, setupThrow }) => {
        const passthroughError = Object.assign(new Error('Custom message'), {
          code: 5710,
          name: 'Unsupported chain id',
        });
        setupThrow(passthroughError);

        const response = await sendPayload(1, method, params);

        expect(response).toHaveProperty('error');
        expect(response.error).toEqual({
          code: 5710,
          name: 'Unsupported chain id',
          message: 'Custom message',
        });
      },
    );

    it('passes through custom error codes via createProviderError', () => {
      const keys = [
        'ATOMICITY_NOT_SUPPORTED',
        'UNSUPPORTED_CHAIN_ID',
        'UNKNOWN_BATCH_ID',
        'DUPLICATE_BATCH_ID',
      ] as const;
      keys.forEach((key) => {
        const err = createProviderError(key);
        expect(typeof err.code).toBe('number');
        expect(typeof err.name).toBe('string');
      });
    });
  });

  describe('unknown errors', () => {
    it.each(EIP5792_METHODS)(
      'returns INTERNAL_ERROR for $method when implementation throws plain Error',
      async ({ method, params, setupThrow }) => {
        setupThrow(new Error('Something went wrong'));

        const response = await sendPayload(1, method, params);

        expect(response).toHaveProperty('error');
        expect(response.error).toEqual({
          code: -32603,
          name: 'Internal error',
          message: 'Something went wrong',
        });
      },
    );

    it.each(EIP5792_METHODS)(
      'returns INTERNAL_ERROR for $method when implementation throws error without code',
      async ({ method, params, setupThrow }) => {
        const err = Object.assign(new Error('No code'), {
          name: 'CustomError',
        });
        setupThrow(err);

        const response = await sendPayload(1, method, params);

        expect(response.error?.code).toBe(-32603);
        expect(response.error?.name).toBe('Internal error');
      },
    );

    it.each(EIP5792_METHODS)(
      'returns INTERNAL_ERROR for $method when implementation throws error without name',
      async ({ method, params, setupThrow }) => {
        const err = Object.assign(new Error('No name'), {
          code: -32004,
          name: 123,
        }); // name must be string for passthrough
        setupThrow(err);

        const response = await sendPayload(1, method, params);

        expect(response.error?.code).toBe(-32603);
        expect(response.error?.name).toBe('Internal error');
      },
    );
  });

  describe('messengerProviderRequest throws', () => {
    it('passes through when messengerProviderRequest throws createProviderError for wallet_sendCalls', async () => {
      const passthroughError = createProviderError(
        'METHOD_NOT_SUPPORTED',
        'Feature disabled',
      );
      messengerProviderRequestMock.mockRejectedValueOnce(passthroughError);

      const response = await sendPayload(1, 'wallet_sendCalls', [
        {
          version: '2.0.0',
          chainId: toHex(mainnet.id),
          from: RAINBOWWALLET_ETH_ADDRESS,
          atomicRequired: false,
          calls: [{ to: RAINBOWWALLET_ETH_ADDRESS as Address, value: 0n }],
        },
      ]);

      expect(response).toHaveProperty('error');
      expect(response.error).toEqual({
        code: -32004,
        name: 'Method not supported',
        message: 'Feature disabled',
      });
    });

    it('returns INTERNAL_ERROR when messengerProviderRequest throws plain Error for wallet_sendCalls', async () => {
      messengerProviderRequestMock.mockRejectedValueOnce(
        new Error('Wallet rejected'),
      );

      const response = await sendPayload(1, 'wallet_sendCalls', [
        {
          version: '2.0.0',
          chainId: toHex(mainnet.id),
          from: RAINBOWWALLET_ETH_ADDRESS,
          atomicRequired: false,
          calls: [{ to: RAINBOWWALLET_ETH_ADDRESS as Address, value: 0n }],
        },
      ]);

      expect(response.error?.code).toBe(-32603);
      expect(response.error?.name).toBe('Internal error');
      expect(response.error?.message).toBe('Wallet rejected');
    });
  });

  describe('capability validation (wallet_sendCalls)', () => {
    const baseSendParams = {
      version: '2.0.0',
      chainId: toHex(mainnet.id),
      from: RAINBOWWALLET_ETH_ADDRESS,
      atomicRequired: false,
      calls: [{ to: RAINBOWWALLET_ETH_ADDRESS as Address, value: 0n }],
    };

    it('rejects when atomicRequired is true and atomic is unsupported (5760)', async () => {
      getCapabilitiesMock.mockResolvedValueOnce({
        [mainnet.id]: { atomic: { status: 'unsupported' } },
      });

      const response = await sendPayload(1, 'wallet_sendCalls', [
        { ...baseSendParams, atomicRequired: true },
      ]);

      expect(response).toHaveProperty('error');
      expect(response.error).toEqual({
        code: 5760,
        name: 'Atomicity not supported',
        message: 'Atomicity not supported',
      });
      expect(setBatchMock).not.toHaveBeenCalled();
    });

    it('proceeds when atomicRequired is true and atomic is supported', async () => {
      const response = await sendPayload(1, 'wallet_sendCalls', [
        { ...baseSendParams, atomicRequired: true },
      ]);

      expect(response).not.toHaveProperty('error');
      expect(response.result).toEqual({ id: '0x123' });
      expect(setBatchMock).toHaveBeenCalled();
    });

    it('rejects when non-optional capability is unsupported (5700)', async () => {
      getCapabilitiesMock.mockResolvedValueOnce({
        [mainnet.id]: {
          atomic: { status: 'supported' },
          // paymasterService not in supported
        },
      });

      const response = await sendPayload(1, 'wallet_sendCalls', [
        {
          ...baseSendParams,
          capabilities: {
            paymasterService: { url: 'https://example.com' }, // not optional
          },
        },
      ]);

      expect(response).toHaveProperty('error');
      expect(response.error).toEqual({
        code: 5700,
        name: 'Unsupported non-optional capability',
        message: 'Unsupported non-optional capability',
      });
      expect(setBatchMock).not.toHaveBeenCalled();
    });

    it('proceeds when optional capability is unsupported', async () => {
      getCapabilitiesMock.mockResolvedValueOnce({
        [mainnet.id]: { atomic: { status: 'supported' } },
      });

      const response = await sendPayload(1, 'wallet_sendCalls', [
        {
          ...baseSendParams,
          capabilities: {
            paymasterService: { url: 'https://example.com', optional: true },
          },
        },
      ]);

      expect(response).not.toHaveProperty('error');
      expect(setBatchMock).toHaveBeenCalled();
    });

    it('proceeds when no capabilities required', async () => {
      const response = await sendPayload(1, 'wallet_sendCalls', [
        baseSendParams,
      ]);

      expect(response).not.toHaveProperty('error');
      expect(setBatchMock).toHaveBeenCalled();
    });

    it('rejects when call-level non-optional capability is unsupported (5700)', async () => {
      getCapabilitiesMock.mockResolvedValueOnce({
        [mainnet.id]: { atomic: { status: 'supported' } },
      });

      const response = await sendPayload(1, 'wallet_sendCalls', [
        {
          ...baseSendParams,
          calls: [
            {
              to: RAINBOWWALLET_ETH_ADDRESS as Address,
              value: 0n,
              capabilities: {
                paymasterService: { url: 'https://example.com' }, // not optional
              },
            },
          ],
        },
      ]);

      expect(response).toHaveProperty('error');
      expect(response.error?.code).toBe(5700);
      expect(setBatchMock).not.toHaveBeenCalled();
    });
  });

  describe('from validation (wallet_sendCalls)', () => {
    const baseSendParams = {
      version: '2.0.0',
      chainId: toHex(mainnet.id),
      from: RAINBOWWALLET_ETH_ADDRESS,
      atomicRequired: false,
      calls: [{ to: RAINBOWWALLET_ETH_ADDRESS as Address, value: 0n }],
    };

    it('rejects when from is not a valid address', async () => {
      const response = await sendPayload(1, 'wallet_sendCalls', [
        { ...baseSendParams, from: '0xinvalid' as Address },
      ]);

      expect(response).toHaveProperty('error');
      expect(response.error).toEqual({
        code: -32602,
        name: 'Invalid params',
        message: 'Invalid from address',
      });
      expect(setBatchMock).not.toHaveBeenCalled();
    });

    it('rejects when from is not a string', async () => {
      const response = await sendPayload(1, 'wallet_sendCalls', [
        { ...baseSendParams, from: 123 as unknown as Address },
      ]);

      expect(response).toHaveProperty('error');
      expect(response.error?.message).toBe('Invalid from address');
      expect(setBatchMock).not.toHaveBeenCalled();
    });

    it('proceeds when from is a valid address matching connected account', async () => {
      const response = await sendPayload(1, 'wallet_sendCalls', [
        { ...baseSendParams, from: RAINBOWWALLET_ETH_ADDRESS },
      ]);

      expect(response).not.toHaveProperty('error');
      expect(setBatchMock).toHaveBeenCalled();
    });

    it('rejects when from is omitted', async () => {
      const response = await sendPayload(1, 'wallet_sendCalls', [
        {
          version: '2.0.0',
          chainId: toHex(mainnet.id),
          atomicRequired: false,
          calls: [{ to: RAINBOWWALLET_ETH_ADDRESS as Address, value: 0n }],
        },
      ]);

      expect(response).toHaveProperty('error');
      expect(response.error).toEqual({
        code: -32602,
        name: 'Invalid params',
        message: 'Invalid params',
      });
      expect(setBatchMock).not.toHaveBeenCalled();
    });

    it('rejects when from does not match connected account', async () => {
      const response = await sendPayload(1, 'wallet_sendCalls', [
        {
          ...baseSendParams,
          from: TESTMAR27_ETH_ADDRESS,
        },
      ]);

      expect(response).toHaveProperty('error');
      expect(response.error).toEqual({
        code: 4100,
        name: 'Unauthorized',
        message: 'from address does not match connected account',
      });
      expect(setBatchMock).not.toHaveBeenCalled();
    });
  });
});
