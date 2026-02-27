import { ServiceError } from './serviceErrors';

interface ApiErrorPayload {
  code?: string;
  message?: string;
  retryAfterMs?: number;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: ApiErrorPayload;
}

interface SendCodeData {
  expiresInMs: number;
  resendInMs: number;
  debugCode?: string;
}

interface VerifyCodeData {
  token: string;
  user: {
    id: string;
    name: string;
    phoneNumber: string;
    avatar?: string;
    socialHandles?: {
      instagram?: string;
      snapchat?: string;
      tiktok?: string;
    };
    createdAt: string;
  };
}

export type VerifyCodeResult =
  | {
      status: 'verified';
      token: string;
      user: VerifyCodeData['user'];
    }
  | {
      status: 'invalid_code';
      message: string;
    };

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_AUTH_API_BASE_URL ?? '').replace(/\/+$/, '');
}

export function isApiAuthEnabled(): boolean {
  const explicitMode = String(import.meta.env.VITE_AUTH_MODE ?? '').toLowerCase();
  if (explicitMode === 'api') {
    return true;
  }
  if (explicitMode === 'mock') {
    return false;
  }
  return Boolean(import.meta.env.PROD);
}

async function safeParseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function mapEnvelopeErrorToServiceError(error: ApiErrorPayload | undefined): ServiceError {
  if (error?.code === 'RATE_LIMITED') {
    return new ServiceError({
      code: 'RATE_LIMITED',
      message: error.message || 'Rate limit reached.',
      retryAfterMs: error.retryAfterMs,
    });
  }

  if (error?.code === 'SMS_DELIVERY_FAILED') {
    return new ServiceError({
      code: 'NETWORK_ERROR',
      message: error.message || 'SMS could not be delivered.',
    });
  }

  return new ServiceError({
    code: 'UNKNOWN_ERROR',
    message: error?.message || 'Auth service error.',
  });
}

async function postJson<T>(path: string, payload: Record<string, unknown>): Promise<ApiEnvelope<T>> {
  const baseUrl = getApiBaseUrl();
  const target = `${baseUrl}${path}`;

  let response: Response;
  try {
    response = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ServiceError({
      code: 'NETWORK_ERROR',
      message: 'Auth service unavailable.',
    });
  }

  const parsed = await safeParseJson<ApiEnvelope<T>>(response);
  if (!parsed) {
    throw new ServiceError({
      code: 'UNKNOWN_ERROR',
      message: 'Invalid auth response.',
    });
  }

  return parsed;
}

export async function sendCodeApi(phoneNumber: string): Promise<SendCodeData> {
  const envelope = await postJson<SendCodeData>('/api/auth/send-code', { phoneNumber });
  if (envelope.ok && envelope.data) {
    return envelope.data;
  }

  throw mapEnvelopeErrorToServiceError(envelope.error);
}

export async function verifyCodeApi(phoneNumber: string, code: string): Promise<VerifyCodeResult> {
  const envelope = await postJson<VerifyCodeData>('/api/auth/verify-code', { phoneNumber, code });
  if (envelope.ok && envelope.data) {
    return {
      status: 'verified',
      token: envelope.data.token,
      user: envelope.data.user,
    };
  }

  if (envelope.error?.code === 'INVALID_CODE' || envelope.error?.code === 'CODE_EXPIRED') {
    return {
      status: 'invalid_code',
      message: envelope.error.message || 'Code ist ungueltig oder abgelaufen.',
    };
  }

  throw mapEnvelopeErrorToServiceError(envelope.error);
}
