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
    DATA_STORE: 'memory',
  };
}

async function invokeJson(
  handler: (req: NodeJS.ReadableStream & Record<string, unknown>, res: Record<string, unknown>) => Promise<void> | void,
  options: {
    method: string;
    url: string;
    body?: unknown;
    ip?: string;
    headers?: Record<string, string>;
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
      ...(options.headers ?? {}),
    },
    socket: {
      remoteAddress: options.ip ?? '127.0.0.1',
    },
  });

  const res: Record<string, unknown> = {
    statusCode: 200,
    setHeader: () => {},
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

async function authenticate(
  handler: (req: NodeJS.ReadableStream & Record<string, unknown>, res: Record<string, unknown>) => Promise<void> | void,
  phoneNumber: string,
) {
  const send = await invokeJson(handler, {
    method: 'POST',
    url: '/api/auth/send-code',
    body: { phoneNumber },
  });
  expect(send.status).toBe(200);
  const debugCode = send.body?.data?.debugCode as string;
  expect(debugCode).toMatch(/^\d{6}$/);

  const verify = await invokeJson(handler, {
    method: 'POST',
    url: '/api/auth/verify-code',
    body: { phoneNumber, code: debugCode },
  });
  expect(verify.status).toBe(200);
  const token = verify.body?.data?.token as string;
  expect(token).toBeTruthy();
  return {
    authorization: `Bearer ${token}`,
  };
}

describe('data api integration', () => {
  it('loads seeded state and persists created events', async () => {
    const runtime = await createAuthServer({
      env: buildTestEnv(),
      configOverrides: {
        exposeDebugCode: true,
      },
    });

    try {
      const unauthorizedState = await invokeJson(runtime.handler, {
        method: 'GET',
        url: '/api/data/state',
      });
      expect(unauthorizedState.status).toBe(401);
      expect(unauthorizedState.body.error.code).toBe('AUTH_REQUIRED');

      const authHeaders = await authenticate(runtime.handler, '+491700100001');

      const state = await invokeJson(runtime.handler, {
        method: 'GET',
        url: '/api/data/state',
        headers: authHeaders,
      });
      expect(state.status).toBe(200);
      expect(state.body.ok).toBe(true);
      expect(state.body.data.events.length).toBeGreaterThan(0);

      const created = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/data/events',
        headers: authHeaders,
        body: {
          title: 'Test Event',
          date: new Date('2026-03-01T18:00:00.000Z').toISOString(),
          time: '18:00',
          createdBy: 'self',
          participants: [{ name: 'Anna', phoneNumber: '+491511111111' }],
          groupIds: ['group_friends'],
          reminderEnabled: true,
        },
      });
      expect(created.status).toBe(200);
      expect(created.body.ok).toBe(true);
      const createdEventId = created.body.data.id as string;

      const fetched = await invokeJson(runtime.handler, {
        method: 'GET',
        url: `/api/data/events/${encodeURIComponent(createdEventId)}`,
        headers: authHeaders,
      });
      expect(fetched.status).toBe(200);
      expect(fetched.body.ok).toBe(true);
      expect(fetched.body.data.id).toBe(createdEventId);
      expect(fetched.body.data.participants).toHaveLength(1);
    } finally {
      await runtime.close();
    }
  });

  it('updates RSVP for same phone instead of creating duplicates', async () => {
    const runtime = await createAuthServer({
      env: buildTestEnv(),
      configOverrides: {
        exposeDebugCode: true,
      },
    });

    try {
      const authHeaders = await authenticate(runtime.handler, '+491700100002');

      const state = await invokeJson(runtime.handler, {
        method: 'GET',
        url: '/api/data/state',
        headers: authHeaders,
      });
      const eventId = state.body.data.events[0].id as string;

      const accepted = await invokeJson(runtime.handler, {
        method: 'POST',
        url: `/api/data/events/${encodeURIComponent(eventId)}/respond`,
        headers: authHeaders,
        body: {
          name: 'Casey',
          phoneNumber: '01710000001',
          status: 'accepted',
        },
      });
      expect(accepted.status).toBe(200);

      const declined = await invokeJson(runtime.handler, {
        method: 'POST',
        url: `/api/data/events/${encodeURIComponent(eventId)}/respond`,
        headers: authHeaders,
        body: {
          name: 'Casey',
          phoneNumber: '+491710000001',
          status: 'declined',
        },
      });
      expect(declined.status).toBe(200);

      const participants = declined.body.data.participants.filter(
        (participant: { phoneNumber: string }) => participant.phoneNumber === '+491710000001',
      );
      expect(participants).toHaveLength(1);
      expect(participants[0].status).toBe('declined');
    } finally {
      await runtime.close();
    }
  });

  it('creates groups, dedupes members and supports RSVP nudges', async () => {
    const runtime = await createAuthServer({
      env: buildTestEnv(),
      configOverrides: {
        exposeDebugCode: true,
      },
    });

    try {
      const authHeaders = await authenticate(runtime.handler, '+491700100003');

      const createdGroup = await invokeJson(runtime.handler, {
        method: 'POST',
        url: '/api/data/groups',
        headers: authHeaders,
        body: {
          name: 'Neue Crew',
          createdBy: 'self',
          members: [{ id: 'm_1', name: 'Mila', phoneNumber: '+491744000001' }],
        },
      });
      expect(createdGroup.status).toBe(200);
      const groupId = createdGroup.body.data.id as string;

      const updatedGroup = await invokeJson(runtime.handler, {
        method: 'POST',
        url: `/api/data/groups/${encodeURIComponent(groupId)}/members`,
        headers: authHeaders,
        body: {
          members: [
            { id: 'm_1_dup', name: 'Mila', phoneNumber: '01744000001' },
            { id: 'm_2', name: 'Noah', phoneNumber: '+491744000002' },
          ],
        },
      });
      expect(updatedGroup.status).toBe(200);
      expect(updatedGroup.body.data.members).toHaveLength(2);

      const state = await invokeJson(runtime.handler, {
        method: 'GET',
        url: '/api/data/state',
        headers: authHeaders,
      });
      const eventId = state.body.data.events[0].id as string;

      const reminder = await invokeJson(runtime.handler, {
        method: 'POST',
        url: `/api/data/events/${encodeURIComponent(eventId)}/reminder`,
        headers: authHeaders,
        body: {
          enabled: true,
        },
      });
      expect(reminder.status).toBe(200);
      expect(reminder.body.data.reminderEnabled).toBe(true);

      const nudge = await invokeJson(runtime.handler, {
        method: 'POST',
        url: `/api/data/events/${encodeURIComponent(eventId)}/nudge`,
        headers: authHeaders,
      });
      expect(nudge.status).toBe(200);
      expect(nudge.body.data.nudgedCount).toBeGreaterThanOrEqual(0);
      expect(nudge.body.data.event).not.toBeNull();
      expect(nudge.body.data.event.lastNudgeAt).toBeTruthy();
    } finally {
      await runtime.close();
    }
  });

  it('serves public invite routes only with valid code+token and allows RSVP', async () => {
    const runtime = await createAuthServer({
      env: buildTestEnv(),
      configOverrides: {
        exposeDebugCode: true,
      },
    });

    try {
      const authHeaders = await authenticate(runtime.handler, '+491700100004');

      const state = await invokeJson(runtime.handler, {
        method: 'GET',
        url: '/api/data/state',
        headers: authHeaders,
      });
      const event = state.body.data.events[0];
      const eventId = event.id as string;
      const link = new URL(event.invitationLink as string);
      const code = link.searchParams.get('code') ?? '';
      const token = link.searchParams.get('token') ?? '';

      const publicGet = await invokeJson(runtime.handler, {
        method: 'GET',
        url: `/api/data/public/events/${encodeURIComponent(eventId)}?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`,
      });
      expect(publicGet.status).toBe(200);
      expect(publicGet.body.data.id).toBe(eventId);

      const invalidTokenGet = await invokeJson(runtime.handler, {
        method: 'GET',
        url: `/api/data/public/events/${encodeURIComponent(eventId)}?code=${encodeURIComponent(code)}&token=broken`,
      });
      expect(invalidTokenGet.status).toBe(404);

      const publicRespond = await invokeJson(runtime.handler, {
        method: 'POST',
        url: `/api/data/public/events/${encodeURIComponent(eventId)}/respond`,
        body: {
          name: 'Invitee',
          phoneNumber: '+491711122233',
          status: 'accepted',
          code,
          token,
        },
      });
      expect(publicRespond.status).toBe(200);
      const participant = publicRespond.body.data.participants.find(
        (entry: { phoneNumber: string }) => entry.phoneNumber === '+491711122233',
      );
      expect(participant?.status).toBe('accepted');
    } finally {
      await runtime.close();
    }
  });
});
