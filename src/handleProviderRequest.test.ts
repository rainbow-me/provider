import { describe, it, vi, expect, beforeAll, Mock } from 'vitest';
import { handleProviderRequest } from './handleProviderRequest';
import { Messenger, createTransport } from './utils/tests';
import {
  ProviderRequestPayload,
  RequestResponse,
} from './references/messengers';
import { Address, isHex } from 'viem';
import { mainnet, optimism } from 'viem/chains';
import { getDefaultProvider } from '@ethersproject/providers';

const TESTMAR27_ETH_ADDRESS: Address =
  '0x5e087b61aad29559e31565079fcdabe384b44614';
const RAINBOWWALLET_ETH_ADDRESS: Address =
  '0x7a3d05c70581bd345fe117c06e45f9669205384f';
const RAINBOWWALLET_ETH_TX_HASH =
  '0xfc621a4577ba3398adc0800400b2ba2c408ab76cdc1521dadbfc802dc93a8b37';

describe('handleProviderRequest', () => {
  const getFeatureFlagsMock = vi.fn(() => ({ custom_rpc: true }));
  const checkRateLimitMock: Mock = vi.fn(() => Promise.resolve(undefined));
  const isSupportedChainMock = vi.fn(() => true);
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
  const getChainMock = vi.fn((chainId: number) => {
    switch (chainId) {
      case 1:
      default:
        return mainnet;
    }
  });
  const getProviderMock = vi.fn(({ chainId }: { chainId?: number }) => {
    switch (chainId) {
      case 1:
      default:
        return getDefaultProvider('mainnet');
    }
  });
  const messengerProviderRequestMock = vi.fn(() => Promise.resolve({}));
  const onAddEthereumChainMock = vi.fn(() => ({ chainAlreadyAdded: true }));
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
      isSupportedChain: isSupportedChainMock,
      getActiveSession: getActiveSessionMock,
      getChain: getChainMock,
      getProvider: getProviderMock,
      messengerProviderRequest: messengerProviderRequestMock,
      onAddEthereumChain: onAddEthereumChainMock,
      onSwitchEthereumChainNotSupported: onSwitchEthereumChainNotSupportedMock,
      onSwitchEthereumChainSupported: onSwitchEthereumChainSupportedMock,
    });
  });

  it('should rate limit requests', async () => {
    checkRateLimitMock.mockImplementationOnce(() =>
      Promise.resolve({ id: 1, error: new Error('Rate Limit Exceeded') }),
    );
    const response = await transport.send(
      { id: 1, method: 'eth_requestAccounts' },
      { id: 1 },
    );
    expect(response).toEqual({
      id: 1,
      error: new Error('Rate Limit Exceeded'),
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
});
