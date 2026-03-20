import type { Address } from 'viem';

export type ActiveSession = { address: Address; chainId: number } | null;
