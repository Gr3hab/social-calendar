import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendCodeApi, verifyCodeApi } from '../src/services/authApi';
import { ServiceError } from '../src/services/serviceErrors';

const originalFetch = global.fetch;

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('authApi service', () => {
  it('returns send-code metadata when API call succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        data: {
          expiresInMs: 300000,
          resendInMs: 30000,
        },
      }),
    );

    const data = await sendCodeApi('+491700000000');
    expect(data.expiresInMs).toBe(300000);
    expect(data.resendInMs).toBe(30000);
  });

  it('throws a rate-limited ServiceError when send-code is throttled', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockResponse(
        {
          ok: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests',
            retryAfterMs: 15000,
          },
        },
        429,
      ),
    );

    await expect(sendCodeApi('+491700000000')).rejects.toEqual(
      expect.objectContaining({
        code: 'RATE_LIMITED',
        retryAfterMs: 15000,
      }),
    );
  });

  it('maps invalid OTP responses to invalid_code result for UX-friendly handling', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockResponse(
        {
          ok: false,
          error: {
            code: 'INVALID_CODE',
            message: 'Code wrong',
          },
        },
        401,
      ),
    );

    const result = await verifyCodeApi('+491700000000', '123456');
    expect(result).toEqual({
      status: 'invalid_code',
      message: 'Code wrong',
    });
  });

  it('returns verified payload when OTP check succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        data: {
          token: 'token-123',
          user: {
            id: 'u1',
            name: '',
            phoneNumber: '+491700000000',
            createdAt: new Date('2026-02-18T11:00:00.000Z').toISOString(),
          },
        },
      }),
    );

    const result = await verifyCodeApi('+491700000000', '123456');
    expect(result).toEqual({
      status: 'verified',
      token: 'token-123',
      user: {
        id: 'u1',
        name: '',
        phoneNumber: '+491700000000',
        createdAt: new Date('2026-02-18T11:00:00.000Z').toISOString(),
      },
    });
  });

  it('throws network ServiceError when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('connection refused'));

    await expect(sendCodeApi('+491700000000')).rejects.toEqual(
      expect.objectContaining({
        code: 'NETWORK_ERROR',
      } satisfies Partial<ServiceError>),
    );
  });

  it('maps SMS delivery errors to network ServiceError for retry UX', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockResponse(
        {
          ok: false,
          error: {
            code: 'SMS_DELIVERY_FAILED',
            message: 'Could not deliver SMS code. Please try again.',
          },
        },
        503,
      ),
    );

    await expect(sendCodeApi('+491700000000')).rejects.toEqual(
      expect.objectContaining({
        code: 'NETWORK_ERROR',
      } satisfies Partial<ServiceError>),
    );
  });
});
