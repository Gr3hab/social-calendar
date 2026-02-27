import type { CreateEventInput, CreateGroupInput, Event, Friend, Group, Participant } from '../types';
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

interface DataStateDto {
  events: EventDto[];
  groups: GroupDto[];
  friends: FriendDto[];
}

interface EventDto {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  time: string;
  location?: string | null;
  createdBy: string;
  participants: ParticipantDto[];
  groups?: string[] | null;
  invitationLink?: string | null;
  invitationCode?: string | null;
  linkExpiresAt?: string | null;
  rsvpDeadline?: string | null;
  lastNudgeAt?: string | null;
  reminderEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ParticipantDto {
  userId: string;
  name: string;
  phoneNumber: string;
  avatar?: string | null;
  status: 'pending' | 'accepted' | 'declined';
  respondedAt?: string | null;
  isLateResponse?: boolean;
}

interface FriendDto {
  id: string;
  name: string;
  phoneNumber: string;
  avatar?: string | null;
}

interface GroupDto {
  id: string;
  name: string;
  description?: string | null;
  createdBy: string;
  members: FriendDto[];
  avatar?: string | null;
  createdAt: string;
}

interface InvitationResponseInput {
  eventId: string;
  name: string;
  phoneNumber: string;
  status: 'accepted' | 'declined';
}

interface PublicInvitationResponseInput extends InvitationResponseInput {
  code: string;
  token?: string;
}

export interface SendRsvpNudgeResult {
  nudgedCount: number;
  event: Event | null;
}

function getDataApiBaseUrl(): string {
  const dataBase = (import.meta.env.VITE_DATA_API_BASE_URL ?? '').trim();
  if (dataBase.length > 0) {
    return dataBase.replace(/\/+$/, '');
  }
  const authBase = (import.meta.env.VITE_AUTH_API_BASE_URL ?? '').trim();
  return authBase.replace(/\/+$/, '');
}

function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const token = window.localStorage.getItem('auth_token');
  if (!token || token.trim().length === 0) {
    return null;
  }
  return token.trim();
}

export function isApiDataEnabled(): boolean {
  const explicitMode = String(import.meta.env.VITE_DATA_MODE ?? '').toLowerCase();
  if (explicitMode === 'api') {
    return true;
  }
  if (explicitMode === 'mock') {
    return false;
  }

  const authMode = String(import.meta.env.VITE_AUTH_MODE ?? '').toLowerCase();
  if (authMode === 'api') {
    return true;
  }
  if (authMode === 'mock') {
    return false;
  }

  return Boolean(import.meta.env.PROD) && getDataApiBaseUrl().length > 0;
}

function toDate(value?: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}

function mapParticipant(dto: ParticipantDto): Participant {
  return {
    userId: dto.userId,
    name: dto.name,
    phoneNumber: dto.phoneNumber,
    avatar: dto.avatar ?? undefined,
    status: dto.status,
    respondedAt: toDate(dto.respondedAt),
    isLateResponse: dto.isLateResponse ?? false,
  };
}

function mapEvent(dto: EventDto): Event {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description ?? undefined,
    date: new Date(dto.date),
    time: dto.time,
    location: dto.location ?? undefined,
    createdBy: dto.createdBy,
    participants: (dto.participants ?? []).map(mapParticipant),
    groups: dto.groups ?? undefined,
    invitationLink: dto.invitationLink ?? undefined,
    invitationCode: dto.invitationCode ?? undefined,
    linkExpiresAt: toDate(dto.linkExpiresAt),
    rsvpDeadline: toDate(dto.rsvpDeadline),
    lastNudgeAt: toDate(dto.lastNudgeAt),
    reminderEnabled: dto.reminderEnabled ?? false,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

function mapFriend(dto: FriendDto): Friend {
  return {
    id: dto.id,
    name: dto.name,
    phoneNumber: dto.phoneNumber,
    avatar: dto.avatar ?? undefined,
  };
}

function mapGroup(dto: GroupDto): Group {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? undefined,
    createdBy: dto.createdBy,
    members: (dto.members ?? []).map(mapFriend),
    avatar: dto.avatar ?? undefined,
    createdAt: new Date(dto.createdAt),
  };
}

function mapStateDto(dto: DataStateDto): { events: Event[]; groups: Group[]; friends: Friend[] } {
  return {
    events: (dto.events ?? []).map(mapEvent),
    groups: (dto.groups ?? []).map(mapGroup),
    friends: (dto.friends ?? []).map(mapFriend),
  };
}

function toEventPayload(input: CreateEventInput) {
  return {
    ...input,
    date: input.date.toISOString(),
    rsvpDeadline: input.rsvpDeadline ? input.rsvpDeadline.toISOString() : undefined,
  };
}

function toGroupPayload(input: CreateGroupInput) {
  return {
    ...input,
    members: input.members.map((member) => ({
      ...member,
      avatar: member.avatar ?? null,
    })),
  };
}

function mapEnvelopeErrorToServiceError(error: ApiErrorPayload | undefined): ServiceError {
  if (error?.code === 'RATE_LIMITED') {
    return new ServiceError({
      code: 'RATE_LIMITED',
      message: error.message || 'Rate limit reached.',
      retryAfterMs: error.retryAfterMs,
    });
  }

  if (error?.code === 'VALIDATION_ERROR') {
    return new ServiceError({
      code: 'UNKNOWN_ERROR',
      message: error.message || 'Validation failed.',
    });
  }

  return new ServiceError({
    code: 'UNKNOWN_ERROR',
    message: error?.message || 'Data service error.',
  });
}

async function safeParseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function requestJson<T>(
  method: 'GET' | 'POST',
  path: string,
  payload?: unknown,
  options?: { auth?: boolean },
): Promise<ApiEnvelope<T>> {
  const baseUrl = getDataApiBaseUrl();
  const target = `${baseUrl}${path}`;
  const shouldSendAuth = options?.auth ?? true;
  const authToken = shouldSendAuth ? getStoredAuthToken() : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let response: Response;
  try {
    response = await fetch(target, {
      method,
      headers,
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
  } catch {
    throw new ServiceError({
      code: 'NETWORK_ERROR',
      message: 'Data service unavailable.',
    });
  }

  const parsed = await safeParseJson<ApiEnvelope<T>>(response);
  if (!parsed) {
    throw new ServiceError({
      code: 'UNKNOWN_ERROR',
      message: 'Invalid data service response.',
    });
  }
  return parsed;
}

function requireData<T>(envelope: ApiEnvelope<T>): T {
  if (envelope.ok && envelope.data !== undefined) {
    return envelope.data;
  }
  throw mapEnvelopeErrorToServiceError(envelope.error);
}

export async function fetchDataStateApi(): Promise<{ events: Event[]; groups: Group[]; friends: Friend[] }> {
  const envelope = await requestJson<DataStateDto>('GET', '/api/data/state');
  return mapStateDto(requireData(envelope));
}

export async function getEventByIdApi(eventId: string): Promise<Event | null> {
  const envelope = await requestJson<EventDto | null>('GET', `/api/data/events/${encodeURIComponent(eventId)}`);
  const event = requireData(envelope);
  return event ? mapEvent(event) : null;
}

export async function createEventApi(input: CreateEventInput): Promise<Event> {
  const envelope = await requestJson<EventDto>('POST', '/api/data/events', toEventPayload(input));
  return mapEvent(requireData(envelope));
}

export async function respondToInvitationApi(input: InvitationResponseInput): Promise<Event | null> {
  const envelope = await requestJson<EventDto | null>(
    'POST',
    `/api/data/events/${encodeURIComponent(input.eventId)}/respond`,
    input,
  );
  const event = requireData(envelope);
  return event ? mapEvent(event) : null;
}

export async function createGroupApi(input: CreateGroupInput): Promise<Group> {
  const envelope = await requestJson<GroupDto>('POST', '/api/data/groups', toGroupPayload(input));
  return mapGroup(requireData(envelope));
}

export async function addMembersToGroupApi(groupId: string, members: Friend[]): Promise<Group | null> {
  const envelope = await requestJson<GroupDto | null>(
    'POST',
    `/api/data/groups/${encodeURIComponent(groupId)}/members`,
    {
      members,
    },
  );
  const group = requireData(envelope);
  return group ? mapGroup(group) : null;
}

export async function toggleEventReminderApi(eventId: string, enabled: boolean): Promise<Event | null> {
  const envelope = await requestJson<EventDto | null>(
    'POST',
    `/api/data/events/${encodeURIComponent(eventId)}/reminder`,
    {
      enabled,
    },
  );
  const event = requireData(envelope);
  return event ? mapEvent(event) : null;
}

export async function sendRsvpNudgeApi(eventId: string): Promise<SendRsvpNudgeResult> {
  const envelope = await requestJson<{ nudgedCount: number; event: EventDto | null }>(
    'POST',
    `/api/data/events/${encodeURIComponent(eventId)}/nudge`,
  );
  const data = requireData(envelope);
  return {
    nudgedCount: data.nudgedCount ?? 0,
    event: data.event ? mapEvent(data.event) : null,
  };
}

export async function getPublicEventByInviteApi(
  eventId: string,
  code: string,
  token?: string | null,
): Promise<Event | null> {
  const query = new URLSearchParams({
    code,
    ...(token ? { token } : {}),
  });
  const envelope = await requestJson<EventDto | null>(
    'GET',
    `/api/data/public/events/${encodeURIComponent(eventId)}?${query.toString()}`,
    undefined,
    { auth: false },
  );
  const event = requireData(envelope);
  return event ? mapEvent(event) : null;
}

export async function respondToInvitationPublicApi(input: PublicInvitationResponseInput): Promise<Event | null> {
  const envelope = await requestJson<EventDto | null>(
    'POST',
    `/api/data/public/events/${encodeURIComponent(input.eventId)}/respond`,
    {
      name: input.name,
      phoneNumber: input.phoneNumber,
      status: input.status,
      code: input.code,
      token: input.token ?? undefined,
    },
    { auth: false },
  );
  const event = requireData(envelope);
  return event ? mapEvent(event) : null;
}
