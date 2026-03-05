import type { RequestError } from './references/messengers';
import { errorCodes } from './references/errorCodes';

export const buildError = ({
  id,
  message,
  errorCode,
}: {
  id: number;
  errorCode: {
    code: number;
    name: string;
  };
  message?: string;
}): { id: number; error: RequestError } => ({
  id,
  error: {
    name: errorCode.name,
    message,
    code: errorCode.code,
  },
});

/** Error shape that callbacks can throw to pass through to the dapp (avoids INTERNAL_ERROR) */
export const isPassThroughError = (
  err: unknown,
): err is { code: number; name: string; message?: string } =>
  err !== null &&
  typeof err === 'object' &&
  typeof (err as { code?: unknown }).code === 'number' &&
  typeof (err as { name?: unknown }).name === 'string';

export const toPassThroughResponse = (
  id: number,
  err: { code: number; name: string; message?: string },
) =>
  buildError({
    id,
    message: err.message,
    errorCode: { code: err.code, name: err.name },
  });

/** Creates an error that will be passed through when thrown from EIP-5792 callbacks. */
export const createProviderError = (
  code: keyof typeof errorCodes,
  message?: string,
) => {
  const errorCode = errorCodes[code];
  return Object.assign(new Error(message ?? errorCode.name), {
    code: errorCode.code,
    name: errorCode.name,
  });
};
