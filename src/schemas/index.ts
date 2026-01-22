import { z } from 'zod';

// ─── Primitives ─────────────────────────────────────────────────────
export const hexString = z.string().regex(/^0x[0-9a-fA-F]*$/);
export const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

// ─── Request Params ─────────────────────────────────────────────────
export const ethSendTransactionParams = z.object({
  from: address,
  to: address.optional(),
  gas: hexString.optional(),
  gasPrice: hexString.optional(),
  value: hexString.optional(),
  data: hexString.optional(),
  nonce: hexString.optional(),
  maxFeePerGas: hexString.optional(),
  maxPriorityFeePerGas: hexString.optional(),
});

export const walletAddEthereumChainParams = z.object({
  chainId: hexString,
  chainName: z.string(),
  nativeCurrency: z.object({
    name: z.string(),
    symbol: z.string().min(1).max(6),
    decimals: z.number().int().min(0).max(36),
  }),
  rpcUrls: z.array(z.string()),
  blockExplorerUrls: z.array(z.string()).optional(),
  iconUrls: z.array(z.string()).optional(),
});

export const walletSwitchEthereumChainParams = z.object({
  chainId: hexString,
});

export const walletWatchAssetParams = z.object({
  type: z.literal('ERC20'),
  options: z.object({
    address: address,
    symbol: z.string().optional(),
    decimals: z.number().optional(),
    image: z.string().optional(),
  }),
});

export const walletSendCallsParams = z.object({
  version: z.string(),
  from: address,
  calls: z.array(
    z.object({
      to: address.optional(),
      data: hexString.optional(),
      value: hexString.optional(),
    }),
  ),
  capabilities: z.record(z.unknown()).optional(),
});

export const personalSignParams = z.tuple([hexString, address]);

export const ethSignTypedDataV4Params = z.tuple([
  address,
  z.union([z.string(), z.record(z.unknown())]),
]);

// ─── Events ─────────────────────────────────────────────────────────
export const connectEvent = z.object({
  type: z.literal('connect'),
  chainId: hexString,
});

export const disconnectEvent = z.object({
  type: z.literal('disconnect'),
  error: z.object({
    code: z.number(),
    message: z.string(),
  }),
});

export const chainChangedEvent = z.object({
  type: z.literal('chainChanged'),
  chainId: hexString,
});

export const accountsChangedEvent = z.object({
  type: z.literal('accountsChanged'),
  accounts: z.array(address),
});

export const providerEvent = z.discriminatedUnion('type', [
  connectEvent,
  disconnectEvent,
  chainChangedEvent,
  accountsChangedEvent,
]);

// ─── Response Types ─────────────────────────────────────────────────
export const ethRequestAccountsResponse = z.array(address);

export const ethChainIdResponse = hexString;

export const walletGetCapabilitiesResponse = z.record(z.record(z.unknown()));

export const walletGetCallsStatusResponse = z.object({
  status: z.enum(['PENDING', 'CONFIRMED']),
  receipts: z
    .array(
      z.object({
        logs: z.array(
          z.object({
            address: address,
            data: hexString,
            topics: z.array(hexString),
          }),
        ),
        status: hexString,
        blockHash: hexString,
        blockNumber: hexString,
        gasUsed: hexString,
        transactionHash: hexString,
      }),
    )
    .optional(),
});

// ─── Type Exports ───────────────────────────────────────────────────
export type HexString = z.infer<typeof hexString>;
export type Address = z.infer<typeof address>;
export type EthSendTransactionParams = z.infer<typeof ethSendTransactionParams>;
export type WalletAddEthereumChainParams = z.infer<
  typeof walletAddEthereumChainParams
>;
export type WalletSwitchEthereumChainParams = z.infer<
  typeof walletSwitchEthereumChainParams
>;
export type WalletWatchAssetParams = z.infer<typeof walletWatchAssetParams>;
export type WalletSendCallsParams = z.infer<typeof walletSendCallsParams>;
export type ConnectEvent = z.infer<typeof connectEvent>;
export type DisconnectEvent = z.infer<typeof disconnectEvent>;
export type ChainChangedEvent = z.infer<typeof chainChangedEvent>;
export type AccountsChangedEvent = z.infer<typeof accountsChangedEvent>;
export type ProviderEvent = z.infer<typeof providerEvent>;
