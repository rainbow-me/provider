import type {
  ProviderTransport,
  HandlerTransport,
  ProviderEvent,
  WalletRequest,
  WalletRequestMeta,
} from '../transports';
import { RpcRequest } from 'ox';

type MockTransportPair = {
  providerTransport: ProviderTransport;
  handlerTransport: HandlerTransport;
};

/**
 * Creates a mock transport pair for testing.
 * Returns both provider-side and handler-side transports that are connected.
 */
export function createMockTransportPair(): MockTransportPair {
  const eventHandlers: Set<(event: ProviderEvent) => void> = new Set();
  let requestHandler: ((request: WalletRequest) => Promise<unknown>) | null =
    null;

  const providerTransport: ProviderTransport = {
    async request(request) {
      if (!requestHandler) {
        throw new Error('No request handler registered');
      }
      const walletRequest = {
        ...request,
        meta: {
          host: 'test.example.com',
          origin: 'https://test.example.com',
        } as WalletRequestMeta,
      } as WalletRequest;
      return requestHandler(walletRequest);
    },
    onEvent(handler) {
      eventHandlers.add(handler);
      return () => eventHandlers.delete(handler);
    },
  };

  const handlerTransport: HandlerTransport = {
    onRequest(handler) {
      requestHandler = handler;
      return () => {
        requestHandler = null;
      };
    },
    pushEvent(event) {
      eventHandlers.forEach((handler) => handler(event));
    },
  };

  return { providerTransport, handlerTransport };
}

/**
 * Creates a mock provider transport for testing the provider side only.
 */
export function createMockProviderTransport(config?: {
  mockResponses?: Record<string, unknown>;
  defaultMeta?: Partial<WalletRequestMeta>;
}): ProviderTransport & {
  pushEvent: (event: ProviderEvent) => void;
  getRequests: () => RpcRequest.RpcRequest[];
} {
  const eventHandlers: Set<(event: ProviderEvent) => void> = new Set();
  const requests: RpcRequest.RpcRequest[] = [];

  return {
    async request(request) {
      requests.push(request);
      const response = config?.mockResponses?.[request.method];
      if (response !== undefined) {
        return response;
      }
      throw new Error(`No mock response for method: ${request.method}`);
    },
    onEvent(handler) {
      eventHandlers.add(handler);
      return () => eventHandlers.delete(handler);
    },
    pushEvent(event: ProviderEvent) {
      eventHandlers.forEach((handler) => handler(event));
    },
    getRequests() {
      return [...requests];
    },
  };
}

/**
 * Creates a mock handler transport for testing the handler side only.
 */
export function createMockHandlerTransport(config?: {
  defaultMeta?: Partial<WalletRequestMeta>;
}): HandlerTransport & {
  sendRequest: <T = unknown>(method: string, params?: unknown[]) => Promise<T>;
  getEvents: () => ProviderEvent[];
} {
  const events: ProviderEvent[] = [];
  let requestHandler: ((request: WalletRequest) => Promise<unknown>) | null =
    null;

  const defaultMeta: WalletRequestMeta = {
    host: 'test.example.com',
    origin: 'https://test.example.com',
    ...config?.defaultMeta,
  };

  return {
    onRequest(handler) {
      requestHandler = handler;
      return () => {
        requestHandler = null;
      };
    },
    pushEvent(event) {
      events.push(event);
    },
    async sendRequest<T = unknown>(
      method: string,
      params?: unknown[],
    ): Promise<T> {
      if (!requestHandler) {
        throw new Error('No request handler registered');
      }
      const request = {
        method,
        params,
        id: Math.floor(Math.random() * 1000000),
        jsonrpc: '2.0',
        meta: defaultMeta,
      } as WalletRequest;
      return requestHandler(request) as Promise<T>;
    },
    getEvents() {
      return [...events];
    },
  };
}
