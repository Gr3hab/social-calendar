// @vitest-environment node

import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createAuthServer } from '../server/authServer.mjs';

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

  const headers = new Map<string, string>();
  const res: Record<string, unknown> = {
    statusCode: 200,
    setHeader: (key: string, value: string) => {
      headers.set(key.toLowerCase(), value);
    },
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
    headers,
  };
}

describe('auth server integration', () => {
  it('sends and verifies OTP successfully for a first-time user', async () => {
    const runtime = await createAuthServer({
      env: buildTestEnv(),
      configOverrides: {
        exposeDebugCode: true,
      },
    });

    try {
      const sendResponse = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/auth/send-code',
        body: { phoneNumber: '01700000000' },
      });

      expect(sendResponse.status).toBe(200);
      expect(sendResponse.body.ok).toBe(true);
      expect(sendResponse.body.data.debugCode).toMatch(/^\d{6}$/);

      const verifyResponse = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/auth/verify-code',
        body: {
          phoneNumber: '+491700000000',
          code: sendResponse.body.data.debugCode,
        },
      });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.ok).toBe(true);
      expect(verifyResponse.body.data.token).toBeTypeOf('string');
      expect(verifyResponse.body.data.user.phoneNumber).toBe('+491700000000');
    } finally {
      await runtime.close();
    }
  });

  it('enforces resend cooldown for the same phone number', async () => {
    const runtime = await createAuthServer({
      env: buildTestEnv(),
      configOverrides: {
        exposeDebugCode: true,
        otpResendCooldownMs: 60_000,
      },
    });

    try {
      const first = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/auth/send-code',
        body: { phoneNumber: '+491700000000' },
      });
      expect(first.status).toBe(200);

      const second = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/auth/send-code',
        body: { phoneNumber: '+491700000000' },
      });

      expect(second.status).toBe(429);
      expect(second.body.error.code).toBe('RATE_LIMITED');
      expect(second.body.error.retryAfterMs).toBeGreaterThan(0);
    } finally {
      await runtime.close();
    }
  });

  it('locks verification after repeated wrong codes and recovers after lock window', async () => {
    let now = Date.now();
    const runtime = await createAuthServer({
      env: buildTestEnv(),
      now: () => now,
      configOverrides: {
        exposeDebugCode: true,
        otpVerifyAttemptsMax: 2,
        otpVerifyLockMs: 120_000,
        otpTtlMs: 300_000,
      },
    });

    try {
      const send = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/auth/send-code',
        body: { phoneNumber: '+491711111111' },
      });
      expect(send.status).toBe(200);
      const validCode = send.body.data.debugCode as string;

      const wrongOne = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/auth/verify-code',
        body: { phoneNumber: '+491711111111', code: '000000' },
      });
      expect(wrongOne.status).toBe(401);
      expect(wrongOne.body.error.code).toBe('INVALID_CODE');
      expect(wrongOne.body.error.remainingAttempts).toBe(1);

      const wrongTwo = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/auth/verify-code',
        body: { phoneNumber: '+491711111111', code: '111111' },
      });
      expect(wrongTwo.status).toBe(429);
      expect(wrongTwo.body.error.code).toBe('RATE_LIMITED');

      const blockedValid = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/auth/verify-code',
        body: { phoneNumber: '+491711111111', code: validCode },
      });
      expect(blockedValid.status).toBe(429);

      now += 121_000;
      const recovered = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/auth/verify-code',
        body: { phoneNumber: '+491711111111', code: validCode },
      });
      expect(recovered.status).toBe(200);
      expect(recovered.body.ok).toBe(true);
    } finally {
      await runtime.close();
    }
  });

  it('enforces and resets phone send rate limit by time window', async () => {
    let now = Date.now();
    const runtime = await createAuthServer({
      env: buildTestEnv(),
      now: () => now,
      configOverrides: {
        exposeDebugCode: true,
        sendPhoneLimit: 2,
        otpResendCooldownMs: 0,
        rateLimitWindowMs: 60_000,
      },
    });

    try {
      const one = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/auth/send-code',
        body: { phoneNumber: '+491722222222' },
      });
      const two = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/auth/send-code',
        body: { phoneNumber: '+491722222222' },
      });
      const three = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/auth/send-code',
        body: { phoneNumber: '+491722222222' },
      });

      expect(one.status).toBe(200);
      expect(two.status).toBe(200);
      expect(three.status).toBe(429);
      expect(three.body.error.code).toBe('RATE_LIMITED');

      now += 60_001;
      const afterWindow = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/auth/send-code',
        body: { phoneNumber: '+491722222222' },
      });
      expect(afterWindow.status).toBe(200);
    } finally {
      await runtime.close();
    }
  });
});
