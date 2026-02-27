// @vitest-environment node

import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { createAuthServer } from '../server/authServer.mjs';
import { SmsDeliveryError } from '../server/smsProviders.mjs';

function buildTestEnv() {
  return {
    ...process.env,
    NODE_ENV: 'test',
    AUTH_API_SECRET: 'test-secret-012345678901234567890123',
    AUTH_API_CORS_ORIGIN: 'http://localhost:5173',
    AUTH_STORE: 'memory',
    AUTH_SMS_PROVIDER: 'mock',
  };
}

async function invokeJson(
  handler: (req: NodeJS.ReadableStream & Record<string, unknown>, res: Record<string, unknown>) => Promise<void> | void,
  options: {
    method: string;
    url: string;
    body?: unknown;
    ip?: string;
  },
) {
  const payload =
    options.body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(options.body), 'utf8');

  const req = Readable.from(payload.length > 0 ? [payload] : []);
  Object.assign(req, {
    method: options.method,
    url: options.url,
    headers: {
      'content-type': 'application/json',
    },
    socket: {
      remoteAddress: options.ip ?? '127.0.0.1',
    },
  });

  const res: Record<string, unknown> = {
    statusCode: 200,
    setHeader: vi.fn(),
    end: (chunk?: string) => {
      const text = chunk ?? '';
      responseBody = typeof text === 'string' ? text : String(text);
    },
  };
  let responseBody = '';

  await handler(req as unknown as NodeJS.ReadableStream & Record<string, unknown>, res);

  return {
    status: Number(res.statusCode ?? 500),
    body: responseBody ? JSON.parse(responseBody) : {},
  };
}

describe('sms delivery behaviour', () => {
  it('uses injected sms sender and keeps debug code hidden when disabled', async () => {
    const smsSender = {
      provider: 'test',
      sendOtp: vi.fn().mockResolvedValue({ messageId: 'msg_1' }),
    };
    const runtime = await createAuthServer({
      env: buildTestEnv(),
      smsSender,
      configOverrides: {
        exposeDebugCode: false,
      },
    });

    try {
      const send = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/auth/send-code',
        body: { phoneNumber: '01700000000' },
      });

      expect(send.status).toBe(200);
      expect(send.body.ok).toBe(true);
      expect(send.body.data.debugCode).toBeUndefined();
      expect(smsSender.sendOtp).toHaveBeenCalledTimes(1);

      const call = smsSender.sendOtp.mock.calls[0][0];
      expect(call.phoneNumber).toBe('+491700000000');
      expect(call.code).toMatch(/^\d{6}$/);
      expect(call.expiresInMs).toBeGreaterThan(0);
    } finally {
      await runtime.close();
    }
  });

  it('maps provider rate-limit failures to API rate-limit response', async () => {
    const smsSender = {
      provider: 'test',
      sendOtp: vi.fn().mockRejectedValue(
        new SmsDeliveryError({
          code: 'SMS_RATE_LIMITED',
          message: 'Provider busy',
          retryAfterMs: 9_000,
          statusCode: 429,
        }),
      ),
    };
    const runtime = await createAuthServer({
      env: buildTestEnv(),
      smsSender,
      configOverrides: {
        exposeDebugCode: false,
      },
    });

    try {
      const send = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/auth/send-code',
        body: { phoneNumber: '+491733333333' },
      });

      expect(send.status).toBe(429);
      expect(send.body.error.code).toBe('RATE_LIMITED');
      expect(send.body.error.retryAfterMs).toBe(9_000);
    } finally {
      await runtime.close();
    }
  });

  it('returns delivery failure when sms provider is unavailable', async () => {
    const smsSender = {
      provider: 'test',
      sendOtp: vi.fn().mockRejectedValue(new Error('provider down')),
    };
    const runtime = await createAuthServer({
      env: buildTestEnv(),
      smsSender,
      configOverrides: {
        exposeDebugCode: false,
      },
    });

    try {
      const send = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/auth/send-code',
        body: { phoneNumber: '+491744444444' },
      });
      expect(send.status).toBe(503);
      expect(send.body.error.code).toBe('SMS_DELIVERY_FAILED');

      const verify = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/auth/verify-code',
        body: { phoneNumber: '+491744444444', code: '123456' },
      });
      expect(verify.status).toBe(401);
      expect(verify.body.error.code).toBe('INVALID_CODE');
    } finally {
      await runtime.close();
    }
  });
});
