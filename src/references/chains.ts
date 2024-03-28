import * as chain from 'viem/chains';

type NativeCurrency = {
  name: string;
  /** 2-6 characters long */
  symbol: string;
  decimals: number;
};

type RpcUrls = {
  http: readonly string[];
  webSocket?: readonly string[];
};

type BlockExplorer = {
  name: string;
  url: string;
};

export type Chain = {
  /** ID in number form */
  id: number;
  /** Human-readable name */
  name: string;
  /** Currency used by chain */
  nativeCurrency: NativeCurrency;
  /** Collection of RPC endpoints */
  rpcUrls: {
    [key: string]: RpcUrls;
    default: RpcUrls;
    public: RpcUrls;
  };
  /** Collection of block explorers */
  blockExplorers?: {
    [key: string]: BlockExplorer;
    default: BlockExplorer;
  };
  /** Flag for test networks */
  testnet?: boolean;
};

export type AddEthereumChainProposedChain = {
  chainId: string;
  rpcUrls: string[];
  chainName: string;
  iconUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrls: string[];
};

export enum ChainId {
  arbitrum = chain.arbitrum.id,
  arbitrumNova = chain.arbitrumNova.id,
  avalanche = chain.avalanche.id,
  base = chain.base.id,
  bsc = chain.bsc.id,
  celo = chain.celo.id,
  gnosis = chain.gnosis.id,
  linea = chain.linea.id,
  manta = chain.manta.id,
  optimism = chain.optimism.id,
  mainnet = chain.mainnet.id,
  polygon = chain.polygon.id,
  polygonZkEvm = chain.polygonZkEvm.id,
  rari = 1380012617,
  zora = chain.zora.id,
  hardhat = chain.hardhat.id,
  hardhatOptimism = 1338,
  goerli = chain.goerli.id,
  sepolia = chain.sepolia.id,
  scroll = chain.scroll.id,
  holesky = chain.holesky.id,
  optimismGoerli = chain.optimismGoerli.id,
  optimismSepolia = chain.optimismSepolia.id,
  bscTestnet = chain.bscTestnet.id,
  polygonMumbai = chain.polygonMumbai.id,
  arbitrumGoerli = chain.arbitrumGoerli.id,
  arbitrumSepolia = chain.arbitrumSepolia.id,
  baseSepolia = chain.baseSepolia.id,
  zoraTestnet = chain.zoraTestnet.id,
  zoraSepolia = chain.zoraSepolia.id,
  fantom = chain.fantom.id,
  harmonyOne = chain.harmonyOne.id,
  moonbeam = chain.moonbeam.id,
}
