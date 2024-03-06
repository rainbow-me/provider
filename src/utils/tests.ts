import EventEmitter from 'eventemitter3';
import {
  CallbackOptions,
  IMessageSender,
  IMessenger,
} from '../references/messengers';

// Placeholder for callback type, adjust according to your actual callback function signature
type CallbackFunction<TPayload, TResponse> = (
  payload: TPayload,
  options: { id?: number | string; sender: IMessageSender; topic: string },
) => Promise<TResponse>;

export function createTransport<TPayload, TResponse>({
  messenger,
  topic,
}: {
  messenger: IMessenger;
  topic: string;
}) {
  if (!messenger.available) {
    console.error(
      `Messenger "${messenger.name}" is not available in this context.`,
    );
  }
  return {
    async send(payload: TPayload, { id }: { id: number }) {
      return messenger.send<TPayload, TResponse>(topic, payload, { id });
    },
    async reply(
      callback: (
        payload: TPayload,
        callbackOptions: CallbackOptions,
      ) => Promise<TResponse>,
    ) {
      messenger.reply(topic, callback);
    },
  };
}

export class Messenger extends EventEmitter implements IMessenger {
  available: boolean;
  name: string;

  constructor(name: string) {
    super();
    this.available = true;
    this.name = name;
  }

  async send<TPayload, TResponse>(
    topic: string,
    payload: TPayload,
    options?: { id?: string | number },
  ): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      const scopedTopic = `${topic}:${options?.id || 'global'}`;
      this.once(scopedTopic, (response: TResponse | Error) => {
        if (response instanceof Error) {
          reject(response);
        } else {
          resolve(response);
        }
      });

      this.emit(topic, payload, options);
    });
  }

  reply<TPayload, TResponse>(
    topic: string,
    callback: CallbackFunction<TPayload, TResponse>,
  ) {
    const listener = async (payload: TPayload, options: { id?: string }) => {
      try {
        const response = await callback(payload, {
          id: options.id,
          topic: topic,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sender: { url: (payload as any).meta?.sender?.url || '' },
        });
        const scopedTopic = `${topic}:${options.id || 'global'}`;
        this.emit(scopedTopic, response);
      } catch (error) {
        const scopedTopic = `${topic}:${options.id || 'global'}`;
        this.emit(scopedTopic, error);
      }
    };

    this.on(topic, listener);

    return () => this.off(topic, listener);
  }
}
