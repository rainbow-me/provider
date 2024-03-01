import { describe, it, vi, expect, beforeAll, Mock } from 'vitest';
import { handleProviderRequest } from './handleProviderRequest';
import { Messenger, createTransport } from './utils/tests';
import {
  ProviderRequestPayload,
  RequestResponse,
} from './references/messengers';
import { Address } from 'viem';
import { mainnet, optimism } from 'viem/chains';
import { getDefaultProvider } from '@ethersproject/providers';

describe('handleProviderRequest', () => {
  const getFeatureFlagsMock = vi.fn(() => ({ custom_rpc: true }));
  const checkRateLimitMock: Mock = vi.fn(() => Promise.resolve(undefined));
  const isSupportedChainMock = vi.fn(() => true);
  const getActiveSessionMock = vi.fn(({ host }: { host: string }) => {
    switch (host) {
      case 'dapp1.com': {
        return {
          address: '0x123' as Address,
          chainId: mainnet.id,
        };
      }
      case 'dapp2.com':
      default: {
        return {
          address: '0x345' as Address,
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
});
