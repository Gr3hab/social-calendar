import type {
  CreateEventInput,
  CreateGroupInput,
  Event,
  Friend,
  Group,
  Participant,
} from '../types';
import { maybeThrowMockFault } from './mockFaults';

const STORAGE_KEY = 'social-calendar:mock-data:v1';
const NETWORK_DELAY_MS = 220;
const INVITATION_EXPIRY_DAYS = 14;
const OPERATION = {
  getMockData: 'data.getMockData',
  getEventById: 'data.getEventById',
  createEvent: 'data.createEvent',
  respondToInvitation: 'data.respondToInvitation',
  createGroup: 'data.createGroup',
  addMembersToGroup: 'data.addMembersToGroup',
  toggleEventReminder: 'data.toggleEventReminder',
  sendRsvpNudge: 'data.sendRsvpNudge',
  getEventsForGroup: 'data.getEventsForGroup',
  resetMockData: 'data.resetMockData',
} as const;

interface MockDataState {
  events: Event[];
  groups: Group[];
  friends: Friend[];
}

interface InvitationResponseInput {
  eventId: string;
  name: string;
  phoneNumber: string;
  status: 'accepted' | 'declined';
}

export interface SendRsvpNudgeResult {
  nudgedCount: number;
  event: Event | null;
}

function delay(ms = NETWORK_DELAY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://social-cal.local';
  }
  return window.location.origin;
}

function generateCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let code = '';
  for (let index = 0; index < length; index += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function createInvitationLink(eventId: string): string {
  return `${getBaseUrl()}/invite/${eventId}?code=${generateCode()}`;
}

function extractInvitationCode(link: string): string | undefined {
  const match = link.match(/[?&]code=([^&]+)/);
  return match?.[1];
}

function inDaysFromNow(daysFromNow: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
}

function inDays(daysFromNow: number, hours: number, minutes = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function normalizePhoneNumber(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const raw = trimmed.replace(/[^\d+]/g, '');
  if (!raw) {
    return '';
  }

  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    return digits ? `+${digits}` : '';
  }

  if (raw.startsWith('00')) {
    const digits = raw.slice(2).replace(/\D/g, '');
    return digits ? `+${digits}` : '';
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  if (digits.startsWith('0')) {
    return `+49${digits.slice(1)}`;
  }

  return `+${digits}`;
}

function createInvitationMeta(eventId: string): {
  invitationLink: string;
  invitationCode?: string;
  linkExpiresAt: Date;
} {
  const invitationLink = createInvitationLink(eventId);
  return {
    invitationLink,
    invitationCode: extractInvitationCode(invitationLink),
    linkExpiresAt: inDaysFromNow(INVITATION_EXPIRY_DAYS),
  };
}

function dedupeByPhone<T extends { phoneNumber: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  items.forEach((item) => {
    if (!item.phoneNumber) {
      return;
    }
    const normalizedPhone = normalizePhoneNumber(item.phoneNumber);
    if (!normalizedPhone || seen.has(normalizedPhone)) {
      return;
    }
    seen.add(normalizedPhone);
    unique.push({ ...item, phoneNumber: normalizedPhone });
  });
  return unique;
}

function asParticipant(
  person: { id?: string; name: string; phoneNumber: string; avatar?: string },
  status: Participant['status'] = 'pending',
): Participant {
  return {
    userId: person.id ?? person.phoneNumber,
    name: person.name,
    phoneNumber: person.phoneNumber,
    avatar: person.avatar,
    status,
    ...(status !== 'pending' ? { respondedAt: new Date() } : {}),
  };
}

function getSeedData(): MockDataState {
  const friends: Friend[] = [
    { id: 'friend_anna', name: 'Anna', phoneNumber: '+491511111111' },
    { id: 'friend_tom', name: 'Tom', phoneNumber: '+491522222222' },
    { id: 'friend_lisa', name: 'Lisa', phoneNumber: '+491533333333' },
    { id: 'friend_mike', name: 'Mike', phoneNumber: '+491544444444' },
    { id: 'friend_sarah', name: 'Sarah', phoneNumber: '+491555555555' },
    { id: 'friend_david', name: 'David', phoneNumber: '+491566666666' },
    { id: 'friend_julia', name: 'Julia', phoneNumber: '+491577777777' },
    { id: 'friend_kev', name: 'Kevin', phoneNumber: '+491588888888' },
  ];

  const currentUser: Friend = {
    id: 'self',
    name: 'Du',
    phoneNumber: '+491700000000',
  };

  const groups: Group[] = [
    {
      id: 'group_friends',
      name: 'Beste Freunde',
      description: 'Spontane Treffen und Abende',
      createdBy: currentUser.id,
      members: [currentUser, friends[0], friends[1], friends[2]],
      createdAt: new Date(),
    },
    {
      id: 'group_sport',
      name: 'Sportteam',
      description: 'Training, Matches und Orga',
      createdBy: currentUser.id,
      members: [currentUser, friends[3], friends[4], friends[5]],
      createdAt: new Date(),
    },
    {
      id: 'group_class',
      name: 'Klasse',
      description: 'Schule, Projekte, Lerngruppen',
      createdBy: currentUser.id,
      members: [currentUser, friends[6], friends[7], friends[0]],
      createdAt: new Date(),
    },
  ];

  const pizzaEventId = 'event_seed_pizza';
  const matchEventId = 'event_seed_match';
  const studyEventId = 'event_seed_study';
  const pizzaInvite = createInvitationMeta(pizzaEventId);
  const matchInvite = createInvitationMeta(matchEventId);
  const studyInvite = createInvitationMeta(studyEventId);

  const events: Event[] = [
    {
      id: pizzaEventId,
      title: 'Pizza + Spieleabend',
      description: 'Kurzer Abend mit Pizza und Mario Kart.',
      date: inDays(2, 19, 0),
      time: '19:00',
      location: 'Pizza Italia, Hauptstr. 42',
      createdBy: currentUser.id,
      participants: [
        asParticipant(currentUser, 'accepted'),
        asParticipant(friends[0], 'accepted'),
        asParticipant(friends[1], 'pending'),
      ],
      groups: ['group_friends'],
      invitationLink: pizzaInvite.invitationLink,
      invitationCode: pizzaInvite.invitationCode,
      linkExpiresAt: pizzaInvite.linkExpiresAt,
      reminderEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: matchEventId,
      title: 'Basketball Training',
      description: 'Warmup + Match Simulation.',
      date: inDays(4, 17, 30),
      time: '17:30',
      location: 'Sporthalle Nord',
      createdBy: currentUser.id,
      participants: [
        asParticipant(currentUser, 'accepted'),
        asParticipant(friends[3], 'accepted'),
        asParticipant(friends[4], 'accepted'),
        asParticipant(friends[5], 'pending'),
      ],
      groups: ['group_sport'],
      invitationLink: matchInvite.invitationLink,
      invitationCode: matchInvite.invitationCode,
      linkExpiresAt: matchInvite.linkExpiresAt,
      reminderEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: studyEventId,
      title: 'Lernsession Mathe',
      description: '1h Aufgaben + Zusammenfassung.',
      date: inDays(6, 16, 0),
      time: '16:00',
      location: 'Stadtbibliothek',
      createdBy: currentUser.id,
      participants: [
        asParticipant(currentUser, 'accepted'),
        asParticipant(friends[6], 'pending'),
        asParticipant(friends[7], 'pending'),
      ],
      groups: ['group_class'],
      invitationLink: studyInvite.invitationLink,
      invitationCode: studyInvite.invitationCode,
      linkExpiresAt: studyInvite.linkExpiresAt,
      reminderEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  return { events, groups, friends };
}

function reviveData(rawData: MockDataState): MockDataState {
  return {
    friends: rawData.friends ?? [],
    groups: (rawData.groups ?? []).map((group) => ({
      ...group,
      createdAt: new Date(group.createdAt),
    })),
    events: (rawData.events ?? []).map((event) => ({
      ...event,
      date: new Date(event.date),
      rsvpDeadline: event.rsvpDeadline ? new Date(event.rsvpDeadline) : undefined,
      lastNudgeAt: event.lastNudgeAt ? new Date(event.lastNudgeAt) : undefined,
      linkExpiresAt: event.linkExpiresAt ? new Date(event.linkExpiresAt) : undefined,
      createdAt: new Date(event.createdAt),
      updatedAt: new Date(event.updatedAt),
      participants: (event.participants ?? []).map((participant) => ({
        ...participant,
        respondedAt: participant.respondedAt ? new Date(participant.respondedAt) : undefined,
      })),
    })),
  };
}

function readState(): MockDataState {
  if (typeof window === 'undefined') {
    return getSeedData();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seed = getSeedData();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }

  try {
    const parsed = JSON.parse(raw) as MockDataState;
    return reviveData(parsed);
  } catch (error) {
    console.error('Failed to parse mock data, resetting.', error);
    const seed = getSeedData();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
}

function writeState(state: MockDataState): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function getMockData(): Promise<MockDataState> {
  maybeThrowMockFault(OPERATION.getMockData);
  await delay();
  return readState();
}

export async function getEventById(eventId: string): Promise<Event | null> {
  maybeThrowMockFault(OPERATION.getEventById);
  await delay();
  const state = readState();
  return state.events.find((event) => event.id === eventId) ?? null;
}

export async function createEvent(input: CreateEventInput): Promise<Event> {
  maybeThrowMockFault(OPERATION.createEvent);
  await delay();

  const state = readState();
  const eventId = generateId('event');
  const invitationMeta = createInvitationMeta(eventId);
  const uniqueParticipants = dedupeByPhone(input.participants);
  const participants = uniqueParticipants.map((participant) => asParticipant(participant, 'pending'));

  const event: Event = {
    id: eventId,
    title: input.title,
    description: input.description?.trim() || undefined,
    date: new Date(input.date),
    time: input.time,
    location: input.location?.trim() || undefined,
    rsvpDeadline: input.rsvpDeadline ? new Date(input.rsvpDeadline) : undefined,
    createdBy: input.createdBy,
    participants,
    groups: input.groupIds?.length ? Array.from(new Set(input.groupIds)) : undefined,
    invitationLink: invitationMeta.invitationLink,
    invitationCode: invitationMeta.invitationCode,
    linkExpiresAt: invitationMeta.linkExpiresAt,
    reminderEnabled: input.reminderEnabled ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  state.events = [event, ...state.events];
  writeState(state);

  return event;
}

export async function respondToInvitation(input: InvitationResponseInput): Promise<Event | null> {
  maybeThrowMockFault(OPERATION.respondToInvitation);
  await delay();

  const state = readState();
  const event = state.events.find((item) => item.id === input.eventId);

  if (!event) {
    return null;
  }

  const normalizedPhone = normalizePhoneNumber(input.phoneNumber);
  if (!normalizedPhone) {
    return event;
  }

  const isLateResponse = Boolean(event.rsvpDeadline && new Date() > event.rsvpDeadline);

  const existingParticipant = event.participants.find(
    (participant) => normalizePhoneNumber(participant.phoneNumber) === normalizedPhone,
  );

  if (existingParticipant) {
    existingParticipant.name = input.name.trim();
    existingParticipant.phoneNumber = normalizedPhone;
    existingParticipant.status = input.status;
    existingParticipant.respondedAt = new Date();
    existingParticipant.isLateResponse = isLateResponse;
  } else {
    const newParticipant = asParticipant(
      {
        name: input.name.trim(),
        phoneNumber: normalizedPhone,
      },
      input.status,
    );

    if (isLateResponse) {
      newParticipant.isLateResponse = true;
    }

    event.participants.push(
      newParticipant,
    );
  }

  event.updatedAt = new Date();
  writeState(state);
  return event;
}

export async function createGroup(input: CreateGroupInput): Promise<Group> {
  maybeThrowMockFault(OPERATION.createGroup);
  await delay();

  const state = readState();
  const group: Group = {
    id: generateId('group'),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    createdBy: input.createdBy,
    members: dedupeByPhone(input.members),
    createdAt: new Date(),
  };

  state.groups = [group, ...state.groups];
  writeState(state);
  return group;
}

export async function addMembersToGroup(groupId: string, members: Friend[]): Promise<Group | null> {
  maybeThrowMockFault(OPERATION.addMembersToGroup);
  await delay();

  const state = readState();
  const group = state.groups.find((entry) => entry.id === groupId);
  if (!group) {
    return null;
  }

  group.members = dedupeByPhone([...group.members, ...members]);
  writeState(state);
  return group;
}

export async function toggleEventReminder(eventId: string, reminderEnabled: boolean): Promise<Event | null> {
  maybeThrowMockFault(OPERATION.toggleEventReminder);
  await delay();

  const state = readState();
  const event = state.events.find((entry) => entry.id === eventId);

  if (!event) {
    return null;
  }

  event.reminderEnabled = reminderEnabled;
  event.updatedAt = new Date();
  writeState(state);
  return event;
}

export async function sendRsvpNudge(eventId: string): Promise<SendRsvpNudgeResult> {
  maybeThrowMockFault(OPERATION.sendRsvpNudge);
  await delay();

  const state = readState();
  const event = state.events.find((entry) => entry.id === eventId);
  if (!event) {
    return { nudgedCount: 0, event: null };
  }

  const nudgedCount = event.participants.filter((participant) => participant.status === 'pending').length;
  event.lastNudgeAt = new Date();
  event.updatedAt = new Date();
  writeState(state);

  return { nudgedCount, event };
}

export async function getEventsForGroup(groupId: string): Promise<Event[]> {
  maybeThrowMockFault(OPERATION.getEventsForGroup);
  await delay();
  const state = readState();
  return state.events.filter((event) => event.groups?.includes(groupId));
}

export async function resetMockData(): Promise<void> {
  maybeThrowMockFault(OPERATION.resetMockData);
  await delay();
  writeState(getSeedData());
}
