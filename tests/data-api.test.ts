import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addMembersToGroupApi,
  createEventApi,
  fetchDataStateApi,
  getPublicEventByInviteApi,
  isApiDataEnabled,
  respondToInvitationApi,
  respondToInvitationPublicApi,
  sendRsvpNudgeApi,
} from '../src/services/dataApi';

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
  vi.unstubAllEnvs();
});

afterEach(() => {
  global.fetch = originalFetch;
  window.localStorage.removeItem('auth_token');
});

describe('dataApi service', () => {
  it('parses dates from state payload into Date objects', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        data: {
          friends: [{ id: 'f1', name: 'Anna', phoneNumber: '+491511111111', avatar: null }],
          groups: [
            {
              id: 'g1',
              name: 'Crew',
              description: null,
              createdBy: 'self',
              members: [{ id: 'f1', name: 'Anna', phoneNumber: '+491511111111', avatar: null }],
              avatar: null,
              createdAt: '2026-02-18T11:00:00.000Z',
            },
          ],
          events: [
            {
              id: 'e1',
              title: 'Meetup',
              description: null,
              date: '2026-03-10T18:00:00.000Z',
              time: '18:00',
              location: null,
              createdBy: 'self',
              participants: [
                {
                  userId: 'f1',
                  name: 'Anna',
                  phoneNumber: '+491511111111',
                  avatar: null,
                  status: 'accepted',
                  respondedAt: '2026-02-18T11:00:00.000Z',
                  isLateResponse: false,
                },
              ],
              groups: ['g1'],
              invitationLink: 'https://social-cal.local/invite/e1?code=abc',
              invitationCode: 'abc',
              linkExpiresAt: '2026-03-24T11:00:00.000Z',
              rsvpDeadline: null,
              lastNudgeAt: null,
              reminderEnabled: true,
              createdAt: '2026-02-18T11:00:00.000Z',
              updatedAt: '2026-02-18T11:00:00.000Z',
            },
          ],
        },
      }),
    );

    const state = await fetchDataStateApi();
    expect(state.events[0].date).toBeInstanceOf(Date);
    expect(state.events[0].participants[0].respondedAt).toBeInstanceOf(Date);
    expect(state.groups[0].createdAt).toBeInstanceOf(Date);
  });

  it('serializes event creation payload and maps response event', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        data: {
          id: 'e_new',
          title: 'Party',
          description: null,
          date: '2026-03-11T19:00:00.000Z',
          time: '19:00',
          location: null,
          createdBy: 'self',
          participants: [],
          groups: ['g1'],
          invitationLink: 'https://social-cal.local/invite/e_new?code=qw8',
          invitationCode: 'qw8',
          linkExpiresAt: '2026-03-25T11:00:00.000Z',
          rsvpDeadline: '2026-03-11T17:00:00.000Z',
          lastNudgeAt: null,
          reminderEnabled: true,
          createdAt: '2026-02-18T11:00:00.000Z',
          updatedAt: '2026-02-18T11:00:00.000Z',
        },
      }),
    );
    global.fetch = fetchMock;

    const event = await createEventApi({
      title: 'Party',
      date: new Date('2026-03-11T19:00:00.000Z'),
      time: '19:00',
      createdBy: 'self',
      participants: [],
      groupIds: ['g1'],
      reminderEnabled: true,
      rsvpDeadline: new Date('2026-03-11T17:00:00.000Z'),
    });

    expect(event.id).toBe('e_new');
    expect(event.date).toBeInstanceOf(Date);
    expect(event.rsvpDeadline).toBeInstanceOf(Date);

    const sentPayload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(sentPayload.date).toBe('2026-03-11T19:00:00.000Z');
    expect(sentPayload.rsvpDeadline).toBe('2026-03-11T17:00:00.000Z');
  });

  it('maps rate limits and unknown errors to ServiceError semantics', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockResponse(
        {
          ok: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many updates',
            retryAfterMs: 4000,
          },
        },
        429,
      ),
    );

    await expect(
      respondToInvitationApi({
        eventId: 'e1',
        name: 'Sam',
        phoneNumber: '+491700000000',
        status: 'accepted',
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'RATE_LIMITED',
        retryAfterMs: 4000,
      }),
    );
  });

  it('keeps dedupe/nudge endpoints compatible with API envelope', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      mockResponse({
        ok: true,
        data: {
          id: 'g1',
          name: 'Crew',
          description: null,
          createdBy: 'self',
          members: [
            { id: 'm1', name: 'A', phoneNumber: '+491700000001', avatar: null },
            { id: 'm2', name: 'B', phoneNumber: '+491700000002', avatar: null },
          ],
          avatar: null,
          createdAt: '2026-02-18T11:00:00.000Z',
        },
      }),
    );

    const group = await addMembersToGroupApi('g1', [
      { id: 'm1', name: 'A', phoneNumber: '+491700000001' },
      { id: 'm2', name: 'B', phoneNumber: '+491700000002' },
    ]);
    expect(group?.members).toHaveLength(2);

    global.fetch = vi.fn().mockResolvedValueOnce(
      mockResponse({
        ok: true,
        data: {
          nudgedCount: 3,
          event: null,
        },
      }),
    );
    const nudge = await sendRsvpNudgeApi('e1');
    expect(nudge.nudgedCount).toBe(3);
    expect(nudge.event).toBeNull();
  });

  it('supports explicit api/mock mode switching', () => {
    vi.stubEnv('VITE_DATA_MODE', 'api');
    expect(isApiDataEnabled()).toBe(true);

    vi.stubEnv('VITE_DATA_MODE', 'mock');
    expect(isApiDataEnabled()).toBe(false);
  });

  it('sends auth headers only to private routes and keeps public invite routes anonymous', async () => {
    window.localStorage.setItem('auth_token', 'token_123');

    const privateFetch = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        data: {
          friends: [],
          groups: [],
          events: [],
        },
      }),
    );
    global.fetch = privateFetch;
    await fetchDataStateApi();
    expect(privateFetch.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer token_123',
    });

    const publicFetch = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        data: {
          id: 'e_public',
          title: 'Oeffentlich',
          description: null,
          date: '2026-03-11T19:00:00.000Z',
          time: '19:00',
          location: null,
          createdBy: 'self',
          participants: [],
          groups: [],
          invitationLink: 'https://social-cal.local/invite/e_public?code=abc&token=signed',
          invitationCode: 'abc',
          linkExpiresAt: '2026-03-25T11:00:00.000Z',
          rsvpDeadline: null,
          lastNudgeAt: null,
          reminderEnabled: true,
          createdAt: '2026-02-18T11:00:00.000Z',
          updatedAt: '2026-02-18T11:00:00.000Z',
        },
      }),
    );
    global.fetch = publicFetch;
    await getPublicEventByInviteApi('e_public', 'abc', 'signed');
    expect(publicFetch.mock.calls[0][1]?.headers).not.toHaveProperty('Authorization');

    const publicRespondFetch = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        data: {
          id: 'e_public',
          title: 'Oeffentlich',
          description: null,
          date: '2026-03-11T19:00:00.000Z',
          time: '19:00',
          location: null,
          createdBy: 'self',
          participants: [],
          groups: [],
          invitationLink: 'https://social-cal.local/invite/e_public?code=abc&token=signed',
          invitationCode: 'abc',
          linkExpiresAt: '2026-03-25T11:00:00.000Z',
          rsvpDeadline: null,
          lastNudgeAt: null,
          reminderEnabled: true,
          createdAt: '2026-02-18T11:00:00.000Z',
          updatedAt: '2026-02-18T11:00:00.000Z',
        },
      }),
    );
    global.fetch = publicRespondFetch;
    await respondToInvitationPublicApi({
      eventId: 'e_public',
      name: 'Mila',
      phoneNumber: '+491700000001',
      status: 'accepted',
      code: 'abc',
      token: 'signed',
    });
    expect(publicRespondFetch.mock.calls[0][1]?.headers).not.toHaveProperty('Authorization');
  });
});
