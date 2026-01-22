import {
  Hash,
  Hex,
  PersonalMessage,
  RpcResponse,
  RpcTransport,
  Secp256k1,
  Signature,
} from 'ox';
import type {
  Session,
  TypedMethodHandlers,
  WalletPermission,
  CallsStatus,
  MethodHandler,
} from '../transports';

// ─── Session Methods ────────────────────────────────────────────────
// Returns chain/account info from session state

type SessionMethods = Pick<
  TypedMethodHandlers,
  'eth_chainId' | 'eth_accounts' | 'eth_coinbase'
>;

export function createSessionMethods(config: {
  getSession: (meta: { host: string }) => Session | null;
}): SessionMethods {
  return {
    eth_chainId: async (req) => {
      const session = config.getSession({ host: req.meta.host });
      return session ? Hex.fromNumber(session.chainId) : '0x1';
    },
    eth_accounts: async (req) => {
      const session = config.getSession({ host: req.meta.host });
      return session ? [session.address] : [];
    },
    eth_coinbase: async (req) => {
      const session = config.getSession({ host: req.meta.host });
      return session?.address ?? null;
    },
  };
}

// ─── RPC Methods ────────────────────────────────────────────────────
// Forwards requests to an RPC node

type RpcMethods = Pick<
  TypedMethodHandlers,
  | 'eth_blockNumber'
  | 'eth_getBalance'
  | 'eth_call'
  | 'eth_estimateGas'
  | 'eth_gasPrice'
  | 'eth_getCode'
  | 'eth_getTransactionByHash'
  | 'eth_getBlockByNumber'
  | 'eth_getBlockByHash'
  | 'eth_getTransactionCount'
  | 'eth_getTransactionReceipt'
  | 'eth_getLogs'
  | 'eth_getStorageAt'
  | 'eth_maxPriorityFeePerGas'
  | 'eth_feeHistory'
>;

export function createRpcMethods(config: {
  transport: RpcTransport.RpcTransport;
}): RpcMethods {
  // Forward all eth_* RPC calls to node
  // The transport.request is already typed, so we pass through
  const forward = async <T>(req: { method: string; params?: unknown }) =>
    config.transport.request(req as never) as T;

  return {
    eth_blockNumber: async (req) => forward(req),
    eth_getBalance: async (req) => forward(req),
    eth_call: async (req) => forward(req),
    eth_estimateGas: async (req) => forward(req),
    eth_gasPrice: async (req) => forward(req),
    eth_getCode: async (req) => forward(req),
    eth_getTransactionByHash: async (req) => forward(req),
    eth_getBlockByNumber: async (req) => forward(req),
    eth_getBlockByHash: async (req) => forward(req),
    eth_getTransactionCount: async (req) => forward(req),
    eth_getTransactionReceipt: async (req) => forward(req),
    eth_getLogs: async (req) => forward(req),
    eth_getStorageAt: async (req) => forward(req),
    eth_maxPriorityFeePerGas: async (req) => forward(req),
    eth_feeHistory: async (req) => forward(req),
  };
}

// ─── Local Methods ──────────────────────────────────────────────────
// Computed locally without RPC calls
// Note: personal_ecRecover is not in RpcSchema.Default, so we use MethodHandler

type LocalMethods = {
  personal_ecRecover: MethodHandler;
  wallet_getPermissions: MethodHandler;
  wallet_getCapabilities: MethodHandler;
  wallet_getCallsStatus: MethodHandler;
};

export function createLocalMethods(config: {
  getPermissions: (host: string) => WalletPermission[];
  getCapabilities: () => Record<string, Record<string, unknown>>;
  getCallsStatus: (batchId: string) => CallsStatus | null;
}): LocalMethods {
  return {
    personal_ecRecover: async (req) => {
      const params = req.params as [string, string];
      const [message, signatureHex] = params;
      // Encode the personal message and hash it
      const personalMessage = PersonalMessage.encode(Hex.fromString(message));
      const payload = Hash.keccak256(personalMessage);
      // Parse the signature hex string into a Signature object
      const signature = Signature.from(signatureHex as Hex.Hex);
      // Recover the address from the payload and signature
      return Secp256k1.recoverAddress({ payload, signature });
    },
    wallet_getPermissions: async (req) => {
      return config.getPermissions(req.meta.host);
    },
    wallet_getCapabilities: async () => {
      return config.getCapabilities();
    },
    wallet_getCallsStatus: async (req) => {
      const params = req.params as [string];
      const [batchId] = params;
      const status = config.getCallsStatus(batchId);
      if (!status) throw new RpcResponse.InvalidParamsError();
      return status;
    },
  };
}
