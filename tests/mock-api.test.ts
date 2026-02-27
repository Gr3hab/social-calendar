import { beforeEach, describe, expect, it } from 'vitest';
import {
  addMembersToGroup,
  createEvent,
  createGroup,
  getEventsForGroup,
  getMockData,
  resetMockData,
  respondToInvitation,
  sendRsvpNudge,
  toggleEventReminder,
} from '../src/services/mockApi';

describe('mockApi MVP contracts', () => {
  beforeEach(async () => {
    await resetMockData();
  });

  it('seeds social data for events, groups and friends', async () => {
    const data = await getMockData();

    expect(data.events.length).toBeGreaterThanOrEqual(3);
    expect(data.groups.length).toBeGreaterThanOrEqual(3);
    expect(data.friends.length).toBeGreaterThanOrEqual(6);
  });

  it('creates events with unique invitation links and deduped participants', async () => {
    const createdEvent = await createEvent({
      title: 'Abend am See',
      description: 'Chill + Musik',
      date: new Date('2026-08-09T18:00:00.000Z'),
      time: '18:00',
      location: 'Stadtsee',
      createdBy: 'self',
      participants: [
        { name: 'Anna', phoneNumber: '+491511111111' },
        { name: 'Anna Duplicate', phoneNumber: '+491511111111' },
        { name: 'Mika', phoneNumber: '+491599999999' },
      ],
      reminderEnabled: true,
      groupIds: ['group_friends'],
    });

    expect(createdEvent.id).toContain('event_');
    expect(createdEvent.invitationLink).toContain(`/invite/${createdEvent.id}`);
    expect(createdEvent.invitationCode).toBeTruthy();
    expect(createdEvent.linkExpiresAt).toBeInstanceOf(Date);
    expect(createdEvent.participants).toHaveLength(2);
    expect(createdEvent.reminderEnabled).toBe(true);
    expect(createdEvent.groups).toEqual(['group_friends']);
  });

  it('normalizes optional fields when creating minimal events', async () => {
    const createdEvent = await createEvent({
      title: 'Minimal Event',
      description: '   ',
      date: new Date('2026-10-01T10:00:00.000Z'),
      time: '10:00',
      location: '   ',
      createdBy: 'self',
      participants: [],
    });

    expect(createdEvent.description).toBeUndefined();
    expect(createdEvent.location).toBeUndefined();
    expect(createdEvent.groups).toBeUndefined();
    expect(createdEvent.reminderEnabled).toBe(false);
  });

  it('revives partial persisted payloads without crashing on missing arrays', async () => {
    window.localStorage.setItem('social-calendar:mock-data:v1', JSON.stringify({}));
    const emptyRevived = await getMockData();

    expect(emptyRevived.friends).toEqual([]);
    expect(emptyRevived.groups).toEqual([]);
    expect(emptyRevived.events).toEqual([]);

    window.localStorage.setItem(
      'social-calendar:mock-data:v1',
      JSON.stringify({
        events: [
          {
            id: 'event_partial',
            title: 'Partial Event',
            date: new Date('2026-10-02T12:00:00.000Z').toISOString(),
            time: '12:00',
            createdBy: 'self',
            createdAt: new Date('2026-10-01T12:00:00.000Z').toISOString(),
            updatedAt: new Date('2026-10-01T12:30:00.000Z').toISOString(),
          },
        ],
      }),
    );

    const revivedWithEvent = await getMockData();
    expect(revivedWithEvent.events[0].participants).toEqual([]);
  });

  it('stores invitation responses for existing and new participants', async () => {
    const { events } = await getMockData();
    const targetEvent = events[0];
    const existingPhone = targetEvent.participants[0].phoneNumber;

    const updatedExisting = await respondToInvitation({
      eventId: targetEvent.id,
      name: 'Updated Name',
      phoneNumber: existingPhone,
      status: 'declined',
    });

    expect(updatedExisting).not.toBeNull();
    const existingParticipant = updatedExisting?.participants.find(
      (participant) => participant.phoneNumber === existingPhone,
    );
    expect(existingParticipant?.status).toBe('declined');
    expect(existingParticipant?.respondedAt).toBeInstanceOf(Date);

    const updatedWithNew = await respondToInvitation({
      eventId: targetEvent.id,
      name: 'Neue Person',
      phoneNumber: '+491234000999',
      status: 'accepted',
    });

    expect(updatedWithNew).not.toBeNull();
    expect(
      updatedWithNew?.participants.some(
        (participant) =>
          participant.phoneNumber === '+491234000999' && participant.status === 'accepted',
      ),
    ).toBe(true);
  });

  it('marks responses as late when RSVP happens after deadline', async () => {
    const created = await createEvent({
      title: 'Late RSVP Event',
      date: new Date('2026-09-10T20:00:00.000Z'),
      time: '20:00',
      createdBy: 'self',
      participants: [],
      rsvpDeadline: new Date('2020-01-01T12:00:00.000Z'),
    });

    const updated = await respondToInvitation({
      eventId: created.id,
      name: 'Late Guest',
      phoneNumber: '+491722222222',
      status: 'accepted',
    });

    const lateParticipant = updated?.participants.find(
      (participant) => participant.phoneNumber === '+491722222222',
    );
    expect(lateParticipant?.isLateResponse).toBe(true);
  });

  it('creates and extends groups with deduped members', async () => {
    const createdGroup = await createGroup({
      name: 'Projektteam',
      description: 'Abschlussprojekt',
      createdBy: 'self',
      members: [
        { id: 'a', name: 'Alex', phoneNumber: '+491700000000' },
        { id: 'b', name: 'Alex Duplicate', phoneNumber: '+491700000000' },
      ],
    });

    expect(createdGroup.members).toHaveLength(1);

    const updatedGroup = await addMembersToGroup(createdGroup.id, [
      { id: 'c', name: 'Mina', phoneNumber: '+491777777777' },
      { id: 'd', name: 'Mina Duplicate', phoneNumber: '+491777777777' },
    ]);

    expect(updatedGroup).not.toBeNull();
    expect(updatedGroup?.members).toHaveLength(2);
  });

  it('toggles reminders and resolves events by group', async () => {
    const { events } = await getMockData();
    const targetEvent = events[0];

    const toggled = await toggleEventReminder(targetEvent.id, !targetEvent.reminderEnabled);
    expect(toggled?.reminderEnabled).toBe(!targetEvent.reminderEnabled);

    const groupedEvents = await getEventsForGroup('group_friends');
    expect(groupedEvents.length).toBeGreaterThan(0);
    expect(groupedEvents.every((event) => event.groups?.includes('group_friends'))).toBe(true);
  });

  it('nudges only pending participants and stores nudge timestamps', async () => {
    const { events } = await getMockData();
    const targetEvent = events[0];

    const result = await sendRsvpNudge(targetEvent.id);
    const pendingCount = targetEvent.participants.filter((participant) => participant.status === 'pending').length;

    expect(result.nudgedCount).toBe(pendingCount);
    expect(result.event?.lastNudgeAt).toBeInstanceOf(Date);

    const unknown = await sendRsvpNudge('event_missing');
    expect(unknown).toEqual({ nudgedCount: 0, event: null });
  });
});
