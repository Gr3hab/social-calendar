export type ServiceErrorCode = 'NETWORK_ERROR' | 'RATE_LIMITED' | 'UNKNOWN_ERROR';

export interface ServiceErrorOptions {
  code: ServiceErrorCode;
  message: string;
  retryAfterMs?: number;
}

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly retryAfterMs?: number;

  constructor(options: ServiceErrorOptions) {
    super(options.message);
    this.name = 'ServiceError';
    this.code = options.code;
    this.retryAfterMs = options.retryAfterMs;
  }
}

export interface ErrorMessageOptions {
  fallback: string;
  network: string;
  rateLimit: string;
}

const DEFAULT_ERROR_MESSAGES: ErrorMessageOptions = {
  fallback: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
  network: 'Verbindung unterbrochen. Bitte versuche es erneut.',
  rateLimit: 'Zu viele Anfragen. Bitte versuche es in Kürze erneut.',
};

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}

export function formatRetryAfter(retryAfterMs?: number): string | null {
  if (!retryAfterMs || retryAfterMs <= 0) {
    return null;
  }

  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return `${seconds}s`;
}

export function getErrorMessage(error: unknown, options?: Partial<ErrorMessageOptions>): string {
  const resolved: ErrorMessageOptions = {
    ...DEFAULT_ERROR_MESSAGES,
    ...options,
  };

  if (!isServiceError(error)) {
    return resolved.fallback;
  }

  if (error.code === 'NETWORK_ERROR') {
    return resolved.network;
  }

  if (error.code === 'RATE_LIMITED') {
    const retryLabel = formatRetryAfter(error.retryAfterMs);
    if (retryLabel) {
      return `${resolved.rateLimit} Bitte in ${retryLabel} erneut versuchen.`;
    }
    return resolved.rateLimit;
  }

  return error.message || resolved.fallback;
}
