import { featureFlags } from '../config/featureFlags';
import { getCurrentProfile, isSupabaseConfigured, supabase } from '../lib/supabase';
import type { CreateEventInput, CreateGroupInput, Event, Friend, Group, Participant } from '../types';
import {
  addMembersToGroup as addMembersToGroupMock,
  createEvent as createEventMock,
  createGroup as createGroupMock,
  getMockData,
  respondToInvitation as respondToInvitationMock,
  sendRsvpNudge as sendRsvpNudgeMock,
  toggleEventReminder as toggleEventReminderMock,
} from './mockApi';
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

interface SupabaseEventRow {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  location: string | null;
  created_by: string;
  invitation_code: string | null;
  rsvp_deadline: string | null;
  reminder_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface SupabaseAttendeeRow {
  event_id: string;
  user_id: string;
  status: 'yes' | 'no' | 'maybe';
  responded_at: string;
  is_late_response: boolean;
}

interface SupabasePublicInviteResponseRow {
  event_id: string;
  phone_number: string;
  display_name: string;
  status: 'yes' | 'no' | 'maybe';
  responded_at: string;
  is_late_response: boolean;
}

interface SupabaseProfileRow {
  id: string;
  display_name: string | null;
  phone_number: string | null;
  avatar_url: string | null;
}

interface PublicEventFunctionPayload {
  event: {
    id: string;
    title: string;
    description?: string | null;
    starts_at: string;
    location?: string | null;
    rsvp_deadline?: string | null;
  };
  attendee_stats?: {
    yes?: number;
    no?: number;
    maybe?: number;
  };
}

interface PublicRsvpFunctionPayload {
  success: boolean;
  rsvp?: {
    status: 'yes' | 'no' | 'maybe';
    responded_at: string;
    is_late_response: boolean;
    display_name: string;
    phone_number: string;
  };
}

export interface SendRsvpNudgeResult {
  nudgedCount: number;
  event: Event | null;
}

const INVITATION_EXPIRY_DAYS = 14;

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

function isSupabaseDirectDataEnabled(): boolean {
  return featureFlags.authMagicLinkOnly && isSupabaseConfigured() && getDataApiBaseUrl().length === 0;
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

  if (isSupabaseDirectDataEnabled()) {
    return true;
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

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getAppOrigin(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:5173';
  }
  return window.location.origin;
}

function buildInvitationLink(eventId: string, invitationCode?: string): string | undefined {
  if (!invitationCode) {
    return undefined;
  }
  return `${getAppOrigin()}/invite/${eventId}?code=${encodeURIComponent(invitationCode)}`;
}

function computeLinkExpiresAt(createdAt: string): Date {
  const base = new Date(createdAt);
  if (Number.isNaN(base.getTime())) {
    return new Date();
  }
  base.setDate(base.getDate() + INVITATION_EXPIRY_DAYS);
  return base;
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

function mapParticipantStatusToSupabase(status: 'accepted' | 'declined'): 'yes' | 'no' {
  return status === 'accepted' ? 'yes' : 'no';
}

function mapSupabaseStatusToParticipant(status: 'yes' | 'no' | 'maybe'): Participant['status'] {
  if (status === 'yes') {
    return 'accepted';
  }
  if (status === 'no') {
    return 'declined';
  }
  return 'pending';
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

function mapSupabaseErrorToService(error: { message?: string } | null | undefined, fallback: string): ServiceError {
  return new ServiceError({
    code: 'UNKNOWN_ERROR',
    message: error?.message || fallback,
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

async function resolveCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw mapSupabaseErrorToService(error, 'Authentication failed.');
  }
  if (!data.user?.id) {
    throw new ServiceError({
      code: 'UNKNOWN_ERROR',
      message: 'Not authenticated.',
    });
  }
  return data.user.id;
}

async function fetchParticipantsByEventIds(eventIds: string[]): Promise<Map<string, Participant[]>> {
  const byEvent = new Map<string, Participant[]>();
  if (eventIds.length === 0) {
    return byEvent;
  }

  const { data: attendeeRowsRaw, error: attendeesError } = await supabase
    .from('event_attendees')
    .select('event_id,user_id,status,responded_at,is_late_response')
    .in('event_id', eventIds);

  if (attendeesError) {
    throw mapSupabaseErrorToService(attendeesError, 'Could not load attendee data.');
  }

  const attendeeRows = (attendeeRowsRaw ?? []) as SupabaseAttendeeRow[];
  const userIds = Array.from(new Set(attendeeRows.map((row) => row.user_id))).filter(Boolean);

  let profileById = new Map<string, SupabaseProfileRow>();
  if (userIds.length > 0) {
    const { data: profilesRaw, error: profilesError } = await supabase
      .from('profiles')
      .select('id,display_name,phone_number,avatar_url')
      .in('id', userIds);
    if (profilesError) {
      throw mapSupabaseErrorToService(profilesError, 'Could not load profile data.');
    }
    const profiles = (profilesRaw ?? []) as SupabaseProfileRow[];
    profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  }

  const { data: publicRowsRaw, error: publicRowsError } = await supabase
    .from('public_invite_responses')
    .select('event_id,phone_number,display_name,status,responded_at,is_late_response')
    .in('event_id', eventIds);

  if (publicRowsError) {
    throw mapSupabaseErrorToService(publicRowsError, 'Could not load public responses.');
  }

  const publicRows = (publicRowsRaw ?? []) as SupabasePublicInviteResponseRow[];
  const participantByEventKey = new Map<string, Map<string, Participant>>();

  for (const row of publicRows) {
    const normalizedPhone = normalizePhoneNumber(row.phone_number);
    const key = normalizedPhone ? `phone:${normalizedPhone}` : `guest:${row.event_id}:${row.display_name}`;
    const eventMap = participantByEventKey.get(row.event_id) ?? new Map<string, Participant>();
    eventMap.set(key, {
      userId: key,
      name: row.display_name || 'Gast',
      phoneNumber: normalizedPhone,
      status: mapSupabaseStatusToParticipant(row.status),
      respondedAt: toDate(row.responded_at),
      isLateResponse: row.is_late_response,
    });
    participantByEventKey.set(row.event_id, eventMap);
  }

  for (const row of attendeeRows) {
    const profile = profileById.get(row.user_id);
    const normalizedPhone = normalizePhoneNumber(profile?.phone_number ?? '');
    const key = normalizedPhone ? `phone:${normalizedPhone}` : `user:${row.user_id}`;
    const eventMap = participantByEventKey.get(row.event_id) ?? new Map<string, Participant>();
    eventMap.set(key, {
      userId: row.user_id,
      name: profile?.display_name || 'Teilnehmer',
      phoneNumber: normalizedPhone,
      avatar: profile?.avatar_url ?? undefined,
      status: mapSupabaseStatusToParticipant(row.status),
      respondedAt: toDate(row.responded_at),
      isLateResponse: row.is_late_response,
    });
    participantByEventKey.set(row.event_id, eventMap);
  }

  for (const [eventId, participantMap] of participantByEventKey.entries()) {
    byEvent.set(eventId, Array.from(participantMap.values()));
  }

  return byEvent;
}

function mapSupabaseEvent(row: SupabaseEventRow, participants: Participant[]): Event {
  const startsAt = new Date(row.starts_at);
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    date: startsAt,
    time: formatTime(startsAt),
    location: row.location ?? undefined,
    createdBy: row.created_by,
    participants,
    invitationLink: buildInvitationLink(row.id, row.invitation_code ?? undefined),
    invitationCode: row.invitation_code ?? undefined,
    linkExpiresAt: computeLinkExpiresAt(row.created_at),
    rsvpDeadline: toDate(row.rsvp_deadline),
    reminderEnabled: row.reminder_enabled,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

async function fetchSupabaseEvents(): Promise<Event[]> {
  const { data: rowsRaw, error } = await supabase
    .from('events')
    .select('id,title,description,starts_at,location,created_by,invitation_code,rsvp_deadline,reminder_enabled,created_at,updated_at')
    .order('starts_at', { ascending: true });

  if (error) {
    throw mapSupabaseErrorToService(error, 'Could not load events.');
  }

  const rows = (rowsRaw ?? []) as SupabaseEventRow[];
  const participantsByEvent = await fetchParticipantsByEventIds(rows.map((row) => row.id));
  return rows.map((row) => mapSupabaseEvent(row, participantsByEvent.get(row.id) ?? []));
}

async function fetchSupabaseEventById(eventId: string): Promise<Event | null> {
  const { data: rowRaw, error } = await supabase
    .from('events')
    .select('id,title,description,starts_at,location,created_by,invitation_code,rsvp_deadline,reminder_enabled,created_at,updated_at')
    .eq('id', eventId)
    .maybeSingle();

  if (error) {
    throw mapSupabaseErrorToService(error, 'Could not load event.');
  }
  if (!rowRaw) {
    return null;
  }

  const participantsByEvent = await fetchParticipantsByEventIds([eventId]);
  return mapSupabaseEvent(rowRaw as SupabaseEventRow, participantsByEvent.get(eventId) ?? []);
}

async function createEventSupabase(input: CreateEventInput): Promise<Event> {
  const userId = await resolveCurrentUserId();
  await getCurrentProfile();

  const { data: createdRaw, error: createError } = await supabase
    .from('events')
    .insert({
      title: input.title,
      description: input.description ?? null,
      starts_at: input.date.toISOString(),
      location: input.location ?? null,
      created_by: userId,
      visibility: 'link',
      rsvp_deadline: input.rsvpDeadline ? input.rsvpDeadline.toISOString() : null,
      reminder_enabled: input.reminderEnabled ?? false,
    })
    .select('id,title,description,starts_at,location,created_by,invitation_code,rsvp_deadline,reminder_enabled,created_at,updated_at')
    .single();

  if (createError) {
    throw mapSupabaseErrorToService(createError, 'Event creation failed.');
  }

  const created = createdRaw as SupabaseEventRow;
  const uniqueParticipants = new Map<string, { phoneNumber: string; name: string }>();
  for (const participant of input.participants) {
    const normalizedPhone = normalizePhoneNumber(participant.phoneNumber);
    if (!normalizedPhone) {
      continue;
    }
    uniqueParticipants.set(normalizedPhone, {
      phoneNumber: normalizedPhone,
      name: participant.name.trim() || 'Kontakt',
    });
  }

  if (uniqueParticipants.size > 0) {
    const upsertRows = Array.from(uniqueParticipants.values()).map((participant) => ({
      event_id: created.id,
      phone_number: participant.phoneNumber,
      display_name: participant.name,
      status: 'maybe',
    }));

    const { error: upsertError } = await supabase
      .from('public_invite_responses')
      .upsert(upsertRows, { onConflict: 'event_id,phone_number' });

    if (upsertError) {
      // Do not block event creation if invite placeholders cannot be persisted.
      console.warn('Failed to store pending invite placeholders', upsertError.message);
    }
  }

  const refreshed = await fetchSupabaseEventById(created.id);
  if (refreshed) {
    return refreshed;
  }

  return mapSupabaseEvent(created, []);
}

async function respondToInvitationSupabase(input: InvitationResponseInput): Promise<Event | null> {
  const userId = await resolveCurrentUserId();
  const currentEvent = await fetchSupabaseEventById(input.eventId);
  if (!currentEvent) {
    return null;
  }

  const isLate = Boolean(currentEvent.rsvpDeadline && new Date() > currentEvent.rsvpDeadline);
  const { error } = await supabase
    .from('event_attendees')
    .upsert(
      {
        event_id: input.eventId,
        user_id: userId,
        status: mapParticipantStatusToSupabase(input.status),
        responded_at: new Date().toISOString(),
        is_late_response: isLate,
      },
      { onConflict: 'event_id,user_id' },
    );

  if (error) {
    throw mapSupabaseErrorToService(error, 'Could not save response.');
  }

  return fetchSupabaseEventById(input.eventId);
}

async function toggleEventReminderSupabase(eventId: string, enabled: boolean): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .update({ reminder_enabled: enabled })
    .eq('id', eventId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw mapSupabaseErrorToService(error, 'Could not update reminder.');
  }
  if (!data) {
    return null;
  }

  return fetchSupabaseEventById(eventId);
}

async function sendRsvpNudgeSupabase(eventId: string): Promise<SendRsvpNudgeResult> {
  const event = await fetchSupabaseEventById(eventId);
  if (!event) {
    return { nudgedCount: 0, event: null };
  }

  const nudgedCount = event.participants.filter((participant) => participant.status === 'pending').length;
  return {
    nudgedCount,
    event: {
      ...event,
      lastNudgeAt: new Date(),
    },
  };
}

function getFunctionsBaseUrl(): string | null {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
  const match = supabaseUrl.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
  if (!match) {
    return null;
  }
  return `https://${match[1]}.functions.supabase.co`;
}

function buildStatsParticipants(stats: PublicEventFunctionPayload['attendee_stats']): Participant[] {
  const yesCount = Number(stats?.yes ?? 0);
  const noCount = Number(stats?.no ?? 0);
  const maybeCount = Number(stats?.maybe ?? 0);
  const participants: Participant[] = [];

  for (let index = 0; index < yesCount; index += 1) {
    participants.push({
      userId: `stat_yes_${index + 1}`,
      name: `Teilnehmer ${index + 1}`,
      phoneNumber: '',
      status: 'accepted',
    });
  }
  for (let index = 0; index < noCount; index += 1) {
    participants.push({
      userId: `stat_no_${index + 1}`,
      name: `Teilnehmer ${yesCount + index + 1}`,
      phoneNumber: '',
      status: 'declined',
    });
  }
  for (let index = 0; index < maybeCount; index += 1) {
    participants.push({
      userId: `stat_maybe_${index + 1}`,
      name: `Teilnehmer ${yesCount + noCount + index + 1}`,
      phoneNumber: '',
      status: 'pending',
    });
  }

  return participants;
}

async function fetchPublicEventByCodeFromFunction(code: string): Promise<Event | null> {
  const functionsBase = getFunctionsBaseUrl();
  if (!functionsBase) {
    throw new ServiceError({
      code: 'UNKNOWN_ERROR',
      message: 'Supabase functions URL is missing.',
    });
  }

  let response: Response;
  try {
    response = await fetch(`${functionsBase}/public-event-hardened?code=${encodeURIComponent(code)}`);
  } catch {
    throw new ServiceError({
      code: 'NETWORK_ERROR',
      message: 'Public event service unavailable.',
    });
  }

  if (response.status === 404) {
    return null;
  }
  if (response.status === 429) {
    throw new ServiceError({
      code: 'RATE_LIMITED',
      message: 'Zu viele Anfragen.',
    });
  }
  if (!response.ok) {
    throw new ServiceError({
      code: 'UNKNOWN_ERROR',
      message: 'Public event request failed.',
    });
  }

  const payload = await safeParseJson<PublicEventFunctionPayload>(response);
  if (!payload?.event?.id || !payload.event.starts_at) {
    return null;
  }

  const startsAt = new Date(payload.event.starts_at);
  const createdAt = startsAt.toISOString();
  return {
    id: payload.event.id,
    title: payload.event.title,
    description: payload.event.description ?? undefined,
    date: startsAt,
    time: formatTime(startsAt),
    location: payload.event.location ?? undefined,
    createdBy: 'public-event',
    participants: buildStatsParticipants(payload.attendee_stats),
    invitationLink: buildInvitationLink(payload.event.id, code),
    invitationCode: code,
    linkExpiresAt: computeLinkExpiresAt(createdAt),
    rsvpDeadline: toDate(payload.event.rsvp_deadline),
    reminderEnabled: false,
    createdAt: startsAt,
    updatedAt: startsAt,
  };
}

async function postPublicRsvpToFunction(input: PublicInvitationResponseInput): Promise<PublicRsvpFunctionPayload> {
  const functionsBase = getFunctionsBaseUrl();
  if (!functionsBase) {
    throw new ServiceError({
      code: 'UNKNOWN_ERROR',
      message: 'Supabase functions URL is missing.',
    });
  }

  let response: Response;
  try {
    response = await fetch(`${functionsBase}/rsvp-public-hardened`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: input.code,
        name: input.name,
        phoneNumber: input.phoneNumber,
        status: mapParticipantStatusToSupabase(input.status),
      }),
    });
  } catch {
    throw new ServiceError({
      code: 'NETWORK_ERROR',
      message: 'Public RSVP service unavailable.',
    });
  }

  if (response.status === 429) {
    throw new ServiceError({
      code: 'RATE_LIMITED',
      message: 'Zu viele RSVP-Anfragen.',
    });
  }
  if (!response.ok) {
    throw new ServiceError({
      code: 'UNKNOWN_ERROR',
      message: 'RSVP request failed.',
    });
  }

  const payload = await safeParseJson<PublicRsvpFunctionPayload>(response);
  if (!payload?.success) {
    throw new ServiceError({
      code: 'UNKNOWN_ERROR',
      message: 'RSVP response invalid.',
    });
  }
  return payload;
}

function attachLatestPublicParticipant(event: Event, input: PublicInvitationResponseInput, payload: PublicRsvpFunctionPayload): Event {
  const normalizedPhone = normalizePhoneNumber(payload.rsvp?.phone_number ?? input.phoneNumber);
  const latestParticipant: Participant = {
    userId: normalizedPhone ? `guest:${normalizedPhone}` : `guest:${input.eventId}:latest`,
    name: (payload.rsvp?.display_name || input.name).trim() || 'Gast',
    phoneNumber: normalizedPhone,
    status: mapSupabaseStatusToParticipant(payload.rsvp?.status ?? mapParticipantStatusToSupabase(input.status)),
    respondedAt: toDate(payload.rsvp?.responded_at) ?? new Date(),
    isLateResponse: Boolean(payload.rsvp?.is_late_response),
  };

  const filtered = event.participants.filter((participant) => {
    if (!normalizedPhone) {
      return participant.userId !== latestParticipant.userId;
    }
    return normalizePhoneNumber(participant.phoneNumber) !== normalizedPhone;
  });

  return {
    ...event,
    participants: [latestParticipant, ...filtered],
  };
}

export async function fetchDataStateApi(): Promise<{ events: Event[]; groups: Group[]; friends: Friend[] }> {
  if (isSupabaseDirectDataEnabled()) {
    const [events, mockState] = await Promise.all([fetchSupabaseEvents(), getMockData()]);
    return {
      events,
      groups: mockState.groups,
      friends: mockState.friends,
    };
  }

  const envelope = await requestJson<DataStateDto>('GET', '/api/data/state');
  return mapStateDto(requireData(envelope));
}

export async function getEventByIdApi(eventId: string): Promise<Event | null> {
  if (isSupabaseDirectDataEnabled()) {
    return fetchSupabaseEventById(eventId);
  }

  const envelope = await requestJson<EventDto | null>('GET', `/api/data/events/${encodeURIComponent(eventId)}`);
  const event = requireData(envelope);
  return event ? mapEvent(event) : null;
}

export async function createEventApi(input: CreateEventInput): Promise<Event> {
  if (isSupabaseDirectDataEnabled()) {
    return createEventSupabase(input);
  }

  const envelope = await requestJson<EventDto>('POST', '/api/data/events', toEventPayload(input));
  return mapEvent(requireData(envelope));
}

export async function respondToInvitationApi(input: InvitationResponseInput): Promise<Event | null> {
  if (isSupabaseDirectDataEnabled()) {
    return respondToInvitationSupabase(input);
  }

  const envelope = await requestJson<EventDto | null>(
    'POST',
    `/api/data/events/${encodeURIComponent(input.eventId)}/respond`,
    input,
  );
  const event = requireData(envelope);
  return event ? mapEvent(event) : null;
}

export async function createGroupApi(input: CreateGroupInput): Promise<Group> {
  if (isSupabaseDirectDataEnabled()) {
    return createGroupMock(input);
  }

  const envelope = await requestJson<GroupDto>('POST', '/api/data/groups', toGroupPayload(input));
  return mapGroup(requireData(envelope));
}

export async function addMembersToGroupApi(groupId: string, members: Friend[]): Promise<Group | null> {
  if (isSupabaseDirectDataEnabled()) {
    return addMembersToGroupMock(groupId, members);
  }

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
  if (isSupabaseDirectDataEnabled()) {
    return toggleEventReminderSupabase(eventId, enabled);
  }

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
  if (isSupabaseDirectDataEnabled()) {
    return sendRsvpNudgeSupabase(eventId);
  }

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
  if (isSupabaseDirectDataEnabled()) {
    const event = await fetchPublicEventByCodeFromFunction(code);
    if (!event) {
      return null;
    }
    if (event.id !== eventId) {
      return null;
    }
    return event;
  }

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
  if (isSupabaseDirectDataEnabled()) {
    const payload = await postPublicRsvpToFunction(input);
    const event = await getPublicEventByInviteApi(input.eventId, input.code, input.token);
    if (!event) {
      return null;
    }
    return attachLatestPublicParticipant(event, input, payload);
  }

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

// Re-export to keep compatibility with older imports.
export {
  createEventMock,
  respondToInvitationMock,
  sendRsvpNudgeMock,
  toggleEventReminderMock,
};
