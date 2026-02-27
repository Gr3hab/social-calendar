import { createHmac, randomUUID } from 'node:crypto';

const DEFAULT_SCOPE = 'default';
const INVITATION_EXPIRY_DAYS = 14;

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function generateId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${randomUUID()}`;
}

function generateCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let code = '';
  for (let index = 0; index < length; index += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function normalizeBaseUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return 'http://127.0.0.1:5173';
  }
  return raw.replace(/\/+$/, '');
}

function signPayload(secret, payload) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', String(secret ?? '')).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function createInvitationMeta(eventId, publicBaseUrl, inviteSecret) {
  const code = generateCode();
  const linkExpiresAt = inDaysFromNowIso(INVITATION_EXPIRY_DAYS);
  const expSeconds = Math.floor(new Date(linkExpiresAt).getTime() / 1000);
  const token = signPayload(inviteSecret, {
    eventId,
    code,
    exp: expSeconds,
  });
  const query = new URLSearchParams({
    code,
    token,
  });

  return {
    invitationLink: `${normalizeBaseUrl(publicBaseUrl)}/invite/${eventId}?${query.toString()}`,
    invitationCode: code,
    linkExpiresAt,
  };
}

function normalizePhoneNumber(value) {
  const trimmed = String(value ?? '').trim();
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

function dedupeByPhone(items) {
  const seen = new Set();
  const unique = [];
  for (const item of items ?? []) {
    const normalizedPhone = normalizePhoneNumber(item.phoneNumber);
    if (!normalizedPhone || seen.has(normalizedPhone)) {
      continue;
    }
    seen.add(normalizedPhone);
    unique.push({
      ...item,
      phoneNumber: normalizedPhone,
    });
  }
  return unique;
}

function toIsoString(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function inDaysFromNowIso(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

function inDaysIso(daysFromNow, hours, minutes = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function asParticipant(person, status = 'pending', nowIso = new Date().toISOString()) {
  const participant = {
    userId: person.id ?? person.phoneNumber,
    name: person.name,
    phoneNumber: person.phoneNumber,
    avatar: person.avatar ?? null,
    status,
    isLateResponse: false,
  };
  if (status !== 'pending') {
    participant.respondedAt = nowIso;
  }
  return participant;
}

function uniqueGroupIds(groupIds) {
  if (!Array.isArray(groupIds)) {
    return null;
  }
  const normalized = Array.from(new Set(groupIds.filter((id) => typeof id === 'string' && id.length > 0)));
  return normalized.length > 0 ? normalized : null;
}

function createSeedData(publicBaseUrl, inviteSecret) {
  const baseUrl = normalizeBaseUrl(publicBaseUrl);
  const friends = [
    { id: 'friend_anna', name: 'Anna', phoneNumber: '+491511111111', avatar: null },
    { id: 'friend_tom', name: 'Tom', phoneNumber: '+491522222222', avatar: null },
    { id: 'friend_lisa', name: 'Lisa', phoneNumber: '+491533333333', avatar: null },
    { id: 'friend_mike', name: 'Mike', phoneNumber: '+491544444444', avatar: null },
    { id: 'friend_sarah', name: 'Sarah', phoneNumber: '+491555555555', avatar: null },
    { id: 'friend_david', name: 'David', phoneNumber: '+491566666666', avatar: null },
    { id: 'friend_julia', name: 'Julia', phoneNumber: '+491577777777', avatar: null },
    { id: 'friend_kev', name: 'Kevin', phoneNumber: '+491588888888', avatar: null },
  ];

  const currentUser = {
    id: 'self',
    name: 'Du',
    phoneNumber: '+491700000000',
    avatar: null,
  };

  const groups = [
    {
      id: 'group_friends',
      name: 'Beste Freunde',
      description: 'Spontane Treffen und Abende',
      createdBy: currentUser.id,
      members: [currentUser, friends[0], friends[1], friends[2]],
      avatar: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'group_sport',
      name: 'Sportteam',
      description: 'Training, Matches und Orga',
      createdBy: currentUser.id,
      members: [currentUser, friends[3], friends[4], friends[5]],
      avatar: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'group_class',
      name: 'Klasse',
      description: 'Schule, Projekte, Lerngruppen',
      createdBy: currentUser.id,
      members: [currentUser, friends[6], friends[7], friends[0]],
      avatar: null,
      createdAt: new Date().toISOString(),
    },
  ];

  const pizzaEventId = 'event_seed_pizza';
  const matchEventId = 'event_seed_match';
  const studyEventId = 'event_seed_study';
  const nowIso = new Date().toISOString();

  function invite(eventId) {
    return createInvitationMeta(eventId, baseUrl, inviteSecret);
  }

  const pizzaInvite = invite(pizzaEventId);
  const matchInvite = invite(matchEventId);
  const studyInvite = invite(studyEventId);

  const events = [
    {
      id: pizzaEventId,
      title: 'Pizza + Spieleabend',
      description: 'Kurzer Abend mit Pizza und Mario Kart.',
      date: inDaysIso(2, 19, 0),
      time: '19:00',
      location: 'Pizza Italia, Hauptstr. 42',
      createdBy: currentUser.id,
      participants: [
        asParticipant(currentUser, 'accepted', nowIso),
        asParticipant(friends[0], 'accepted', nowIso),
        asParticipant(friends[1], 'pending', nowIso),
      ],
      groups: ['group_friends'],
      invitationLink: pizzaInvite.invitationLink,
      invitationCode: pizzaInvite.invitationCode,
      linkExpiresAt: pizzaInvite.linkExpiresAt,
      rsvpDeadline: null,
      lastNudgeAt: null,
      reminderEnabled: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: matchEventId,
      title: 'Basketball Training',
      description: 'Warmup + Match Simulation.',
      date: inDaysIso(4, 17, 30),
      time: '17:30',
      location: 'Sporthalle Nord',
      createdBy: currentUser.id,
      participants: [
        asParticipant(currentUser, 'accepted', nowIso),
        asParticipant(friends[3], 'accepted', nowIso),
        asParticipant(friends[4], 'accepted', nowIso),
        asParticipant(friends[5], 'pending', nowIso),
      ],
      groups: ['group_sport'],
      invitationLink: matchInvite.invitationLink,
      invitationCode: matchInvite.invitationCode,
      linkExpiresAt: matchInvite.linkExpiresAt,
      rsvpDeadline: null,
      lastNudgeAt: null,
      reminderEnabled: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: studyEventId,
      title: 'Lernsession Mathe',
      description: '1h Aufgaben + Zusammenfassung.',
      date: inDaysIso(6, 16, 0),
      time: '16:00',
      location: 'Stadtbibliothek',
      createdBy: currentUser.id,
      participants: [
        asParticipant(currentUser, 'accepted', nowIso),
        asParticipant(friends[6], 'pending', nowIso),
        asParticipant(friends[7], 'pending', nowIso),
      ],
      groups: ['group_class'],
      invitationLink: studyInvite.invitationLink,
      invitationCode: studyInvite.invitationCode,
      linkExpiresAt: studyInvite.linkExpiresAt,
      rsvpDeadline: null,
      lastNudgeAt: null,
      reminderEnabled: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  return {
    events,
    groups,
    friends,
  };
}

function createRepositoryOperations(options) {
  const publicBaseUrl = normalizeBaseUrl(options.publicBaseUrl);
  const inviteSecret = String(options.inviteSecret ?? 'dev-invite-secret');

  async function listState(loadState) {
    const state = await loadState();
    return deepClone(state);
  }

  async function getEventById(loadState, eventId) {
    const state = await loadState();
    const event = state.events.find((entry) => entry.id === eventId);
    return event ? deepClone(event) : null;
  }

  async function createEvent(mutateState, input) {
    const title = String(input?.title ?? '').trim();
    const time = String(input?.time ?? '').trim();
    const createdBy = String(input?.createdBy ?? '').trim();
    const dateIso = toIsoString(input?.date);
    if (!title || !time || !createdBy || !dateIso) {
      throw new Error('VALIDATION_ERROR');
    }

    return mutateState((state) => {
      const nowIso = new Date().toISOString();
      const eventId = generateId('event');
      const invitationMeta = createInvitationMeta(eventId, publicBaseUrl, inviteSecret);
      const participants = dedupeByPhone(input.participants ?? []).map((participant) =>
        asParticipant(
          {
            id: participant.id,
            name: String(participant.name ?? '').trim() || 'Kontakt',
            phoneNumber: participant.phoneNumber,
            avatar: participant.avatar ?? null,
          },
          'pending',
          nowIso,
        ),
      );
      const rsvpDeadline = input.rsvpDeadline ? toIsoString(input.rsvpDeadline) : null;
      const event = {
        id: eventId,
        title,
        description: String(input.description ?? '').trim() || null,
        date: dateIso,
        time,
        location: String(input.location ?? '').trim() || null,
        createdBy,
        participants,
        groups: uniqueGroupIds(input.groupIds),
        invitationLink: invitationMeta.invitationLink,
        invitationCode: invitationMeta.invitationCode,
        linkExpiresAt: invitationMeta.linkExpiresAt,
        rsvpDeadline,
        lastNudgeAt: null,
        reminderEnabled: Boolean(input.reminderEnabled),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      state.events = [event, ...state.events];
      return event;
    });
  }

  async function respondToInvitation(mutateState, input) {
    const eventId = String(input?.eventId ?? '').trim();
    const status = input?.status;
    if (!eventId || (status !== 'accepted' && status !== 'declined')) {
      throw new Error('VALIDATION_ERROR');
    }

    const normalizedPhone = normalizePhoneNumber(input.phoneNumber);
    const normalizedName = String(input.name ?? '').trim() || 'Kontakt';

    return mutateState((state) => {
      const event = state.events.find((entry) => entry.id === eventId);
      if (!event) {
        return null;
      }
      if (!normalizedPhone) {
        return event;
      }

      const nowIso = new Date().toISOString();
      const isLateResponse = Boolean(event.rsvpDeadline && new Date(nowIso) > new Date(event.rsvpDeadline));
      const participant = event.participants.find(
        (entry) => normalizePhoneNumber(entry.phoneNumber) === normalizedPhone,
      );
      if (participant) {
        participant.name = normalizedName;
        participant.phoneNumber = normalizedPhone;
        participant.status = status;
        participant.respondedAt = nowIso;
        participant.isLateResponse = isLateResponse;
      } else {
        event.participants.push({
          userId: normalizedPhone,
          name: normalizedName,
          phoneNumber: normalizedPhone,
          avatar: null,
          status,
          respondedAt: nowIso,
          isLateResponse,
        });
      }

      event.updatedAt = nowIso;
      return event;
    });
  }

  async function createGroup(mutateState, input) {
    const name = String(input?.name ?? '').trim();
    const createdBy = String(input?.createdBy ?? '').trim();
    if (!name || !createdBy) {
      throw new Error('VALIDATION_ERROR');
    }

    return mutateState((state) => {
      const group = {
        id: generateId('group'),
        name,
        description: String(input.description ?? '').trim() || null,
        createdBy,
        members: dedupeByPhone(input.members ?? []).map((member) => ({
          id: member.id ?? `member_${normalizePhoneNumber(member.phoneNumber)}`,
          name: String(member.name ?? '').trim() || 'Kontakt',
          phoneNumber: normalizePhoneNumber(member.phoneNumber),
          avatar: member.avatar ?? null,
        })),
        avatar: null,
        createdAt: new Date().toISOString(),
      };
      state.groups = [group, ...state.groups];
      return group;
    });
  }

  async function addMembersToGroup(mutateState, groupId, members) {
    const normalizedGroupId = String(groupId ?? '').trim();
    if (!normalizedGroupId) {
      throw new Error('VALIDATION_ERROR');
    }

    return mutateState((state) => {
      const group = state.groups.find((entry) => entry.id === normalizedGroupId);
      if (!group) {
        return null;
      }

      const normalizedMembers = dedupeByPhone([...(group.members ?? []), ...(members ?? [])]).map((member) => ({
        id: member.id ?? `member_${normalizePhoneNumber(member.phoneNumber)}`,
        name: String(member.name ?? '').trim() || 'Kontakt',
        phoneNumber: normalizePhoneNumber(member.phoneNumber),
        avatar: member.avatar ?? null,
      }));
      group.members = normalizedMembers;
      return group;
    });
  }

  async function toggleEventReminder(mutateState, eventId, reminderEnabled) {
    const normalizedEventId = String(eventId ?? '').trim();
    if (!normalizedEventId) {
      throw new Error('VALIDATION_ERROR');
    }

    return mutateState((state) => {
      const event = state.events.find((entry) => entry.id === normalizedEventId);
      if (!event) {
        return null;
      }
      event.reminderEnabled = Boolean(reminderEnabled);
      event.updatedAt = new Date().toISOString();
      return event;
    });
  }

  async function sendRsvpNudge(mutateState, eventId) {
    const normalizedEventId = String(eventId ?? '').trim();
    if (!normalizedEventId) {
      throw new Error('VALIDATION_ERROR');
    }

    return mutateState((state) => {
      const event = state.events.find((entry) => entry.id === normalizedEventId);
      if (!event) {
        return {
          nudgedCount: 0,
          event: null,
        };
      }

      const nudgedCount = event.participants.filter((participant) => participant.status === 'pending').length;
      event.lastNudgeAt = new Date().toISOString();
      event.updatedAt = new Date().toISOString();
      return {
        nudgedCount,
        event,
      };
    });
  }

  return {
    listState,
    getEventById,
    createEvent,
    respondToInvitation,
    createGroup,
    addMembersToGroup,
    toggleEventReminder,
    sendRsvpNudge,
  };
}

export class InMemoryDataRepository {
  constructor(options = {}) {
    this.publicBaseUrl = options.publicBaseUrl;
    this.inviteSecret = String(options.inviteSecret ?? 'dev-invite-secret');
    this.state = deepClone(options.seedState ?? createSeedData(options.publicBaseUrl, this.inviteSecret));
    this.operations = createRepositoryOperations({
      publicBaseUrl: options.publicBaseUrl,
      inviteSecret: this.inviteSecret,
    });
  }

  async listState() {
    return this.operations.listState(async () => this.state);
  }

  async getEventById(eventId) {
    return this.operations.getEventById(async () => this.state, eventId);
  }

  async createEvent(input) {
    return this.operations.createEvent(async (mutator) => {
      const working = deepClone(this.state);
      const result = mutator(working);
      this.state = working;
      return deepClone(result);
    }, input);
  }

  async respondToInvitation(input) {
    return this.operations.respondToInvitation(async (mutator) => {
      const working = deepClone(this.state);
      const result = mutator(working);
      this.state = working;
      return deepClone(result);
    }, input);
  }

  async createGroup(input) {
    return this.operations.createGroup(async (mutator) => {
      const working = deepClone(this.state);
      const result = mutator(working);
      this.state = working;
      return deepClone(result);
    }, input);
  }

  async addMembersToGroup(groupId, members) {
    return this.operations.addMembersToGroup(async (mutator) => {
      const working = deepClone(this.state);
      const result = mutator(working);
      this.state = working;
      return deepClone(result);
    }, groupId, members);
  }

  async toggleEventReminder(eventId, reminderEnabled) {
    return this.operations.toggleEventReminder(async (mutator) => {
      const working = deepClone(this.state);
      const result = mutator(working);
      this.state = working;
      return deepClone(result);
    }, eventId, reminderEnabled);
  }

  async sendRsvpNudge(eventId) {
    return this.operations.sendRsvpNudge(async (mutator) => {
      const working = deepClone(this.state);
      const result = mutator(working);
      this.state = working;
      return deepClone(result);
    }, eventId);
  }

  async close() {
    this.state = deepClone(createSeedData(this.publicBaseUrl, this.inviteSecret));
  }
}

export class PostgresDataRepository {
  constructor(pool, options = {}) {
    this.pool = pool;
    this.scope = options.scope ?? DEFAULT_SCOPE;
    this.publicBaseUrl = options.publicBaseUrl;
    this.inviteSecret = String(options.inviteSecret ?? 'dev-invite-secret');
    this.operations = createRepositoryOperations({
      publicBaseUrl: options.publicBaseUrl,
      inviteSecret: this.inviteSecret,
    });
    this.legacySnapshotTableName = options.legacySnapshotTableName ?? 'app_data_state';
    this.initialized = false;
  }

  async ensureSchema(client) {
    if (this.initialized) {
      return;
    }
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_friend (
        scope TEXT NOT NULL,
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        avatar TEXT,
        PRIMARY KEY(scope, id),
        UNIQUE(scope, phone_number)
      );

      CREATE TABLE IF NOT EXISTS app_group (
        scope TEXT NOT NULL,
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_by TEXT NOT NULL,
        avatar TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY(scope, id)
      );

      CREATE TABLE IF NOT EXISTS app_group_member (
        scope TEXT NOT NULL,
        group_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        avatar TEXT,
        PRIMARY KEY(scope, group_id, phone_number),
        FOREIGN KEY(scope, group_id) REFERENCES app_group(scope, id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_event (
        scope TEXT NOT NULL,
        id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        starts_at TIMESTAMPTZ NOT NULL,
        time TEXT NOT NULL,
        location TEXT,
        created_by TEXT NOT NULL,
        invitation_link TEXT,
        invitation_code TEXT,
        link_expires_at TIMESTAMPTZ,
        rsvp_deadline TIMESTAMPTZ,
        last_nudge_at TIMESTAMPTZ,
        reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY(scope, id)
      );

      CREATE TABLE IF NOT EXISTS app_event_participant (
        scope TEXT NOT NULL,
        event_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        avatar TEXT,
        status TEXT NOT NULL,
        responded_at TIMESTAMPTZ,
        is_late_response BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY(scope, event_id, phone_number),
        FOREIGN KEY(scope, event_id) REFERENCES app_event(scope, id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_event_group (
        scope TEXT NOT NULL,
        event_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        PRIMARY KEY(scope, event_id, group_id),
        FOREIGN KEY(scope, event_id) REFERENCES app_event(scope, id) ON DELETE CASCADE
      );
    `);
    this.initialized = true;
  }

  async readStateTx(client) {
    const [friendsResult, groupsResult, groupMembersResult, eventsResult, eventGroupsResult, participantsResult] =
      await Promise.all([
        client.query(
          `
            SELECT id, name, phone_number, avatar
            FROM app_friend
            WHERE scope = $1
            ORDER BY name ASC
          `,
          [this.scope],
        ),
        client.query(
          `
            SELECT id, name, description, created_by, avatar, created_at
            FROM app_group
            WHERE scope = $1
            ORDER BY created_at DESC
          `,
          [this.scope],
        ),
        client.query(
          `
            SELECT group_id, member_id, name, phone_number, avatar
            FROM app_group_member
            WHERE scope = $1
            ORDER BY group_id ASC, name ASC
          `,
          [this.scope],
        ),
        client.query(
          `
            SELECT
              id,
              title,
              description,
              starts_at,
              time,
              location,
              created_by,
              invitation_link,
              invitation_code,
              link_expires_at,
              rsvp_deadline,
              last_nudge_at,
              reminder_enabled,
              created_at,
              updated_at
            FROM app_event
            WHERE scope = $1
            ORDER BY updated_at DESC, starts_at ASC
          `,
          [this.scope],
        ),
        client.query(
          `
            SELECT event_id, group_id
            FROM app_event_group
            WHERE scope = $1
            ORDER BY event_id ASC, group_id ASC
          `,
          [this.scope],
        ),
        client.query(
          `
            SELECT
              event_id,
              user_id,
              name,
              phone_number,
              avatar,
              status,
              responded_at,
              is_late_response
            FROM app_event_participant
            WHERE scope = $1
            ORDER BY event_id ASC, name ASC
          `,
          [this.scope],
        ),
      ]);

    const friends = friendsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      phoneNumber: row.phone_number,
      avatar: row.avatar ?? null,
    }));

    const membersByGroup = new Map();
    for (const row of groupMembersResult.rows) {
      const members = membersByGroup.get(row.group_id) ?? [];
      members.push({
        id: row.member_id,
        name: row.name,
        phoneNumber: row.phone_number,
        avatar: row.avatar ?? null,
      });
      membersByGroup.set(row.group_id, members);
    }

    const groups = groupsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      createdBy: row.created_by,
      members: membersByGroup.get(row.id) ?? [],
      avatar: row.avatar ?? null,
      createdAt: new Date(row.created_at).toISOString(),
    }));

    const groupsByEvent = new Map();
    for (const row of eventGroupsResult.rows) {
      const list = groupsByEvent.get(row.event_id) ?? [];
      list.push(row.group_id);
      groupsByEvent.set(row.event_id, list);
    }

    const participantsByEvent = new Map();
    for (const row of participantsResult.rows) {
      const list = participantsByEvent.get(row.event_id) ?? [];
      list.push({
        userId: row.user_id,
        name: row.name,
        phoneNumber: row.phone_number,
        avatar: row.avatar ?? null,
        status: row.status,
        respondedAt: row.responded_at ? new Date(row.responded_at).toISOString() : null,
        isLateResponse: Boolean(row.is_late_response),
      });
      participantsByEvent.set(row.event_id, list);
    }

    const events = eventsResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description ?? null,
      date: new Date(row.starts_at).toISOString(),
      time: row.time,
      location: row.location ?? null,
      createdBy: row.created_by,
      participants: participantsByEvent.get(row.id) ?? [],
      groups: (groupsByEvent.get(row.id) ?? []).length > 0 ? groupsByEvent.get(row.id) : null,
      invitationLink: row.invitation_link ?? null,
      invitationCode: row.invitation_code ?? null,
      linkExpiresAt: row.link_expires_at ? new Date(row.link_expires_at).toISOString() : null,
      rsvpDeadline: row.rsvp_deadline ? new Date(row.rsvp_deadline).toISOString() : null,
      lastNudgeAt: row.last_nudge_at ? new Date(row.last_nudge_at).toISOString() : null,
      reminderEnabled: Boolean(row.reminder_enabled),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    }));

    return {
      friends,
      groups,
      events,
    };
  }

  async writeStateTx(client, stateInput) {
    const state = {
      friends: Array.isArray(stateInput?.friends) ? stateInput.friends : [],
      groups: Array.isArray(stateInput?.groups) ? stateInput.groups : [],
      events: Array.isArray(stateInput?.events) ? stateInput.events : [],
    };

    await client.query('DELETE FROM app_event_group WHERE scope = $1', [this.scope]);
    await client.query('DELETE FROM app_event_participant WHERE scope = $1', [this.scope]);
    await client.query('DELETE FROM app_event WHERE scope = $1', [this.scope]);
    await client.query('DELETE FROM app_group_member WHERE scope = $1', [this.scope]);
    await client.query('DELETE FROM app_group WHERE scope = $1', [this.scope]);
    await client.query('DELETE FROM app_friend WHERE scope = $1', [this.scope]);

    for (const friend of state.friends) {
      const phone = normalizePhoneNumber(friend.phoneNumber);
      if (!phone) {
        continue;
      }
      await client.query(
        `
          INSERT INTO app_friend(scope, id, name, phone_number, avatar)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [this.scope, friend.id ?? `friend_${phone}`, String(friend.name ?? '').trim() || 'Kontakt', phone, friend.avatar ?? null],
      );
    }

    for (const group of state.groups) {
      const createdAtIso = toIsoString(group.createdAt) ?? new Date().toISOString();
      await client.query(
        `
          INSERT INTO app_group(scope, id, name, description, created_by, avatar, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)
        `,
        [
          this.scope,
          group.id,
          String(group.name ?? '').trim() || 'Gruppe',
          group.description ?? null,
          group.createdBy ?? 'unknown',
          group.avatar ?? null,
          createdAtIso,
        ],
      );

      const members = dedupeByPhone(group.members ?? []);
      for (const member of members) {
        await client.query(
          `
            INSERT INTO app_group_member(scope, group_id, member_id, name, phone_number, avatar)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            this.scope,
            group.id,
            member.id ?? `member_${member.phoneNumber}`,
            String(member.name ?? '').trim() || 'Kontakt',
            member.phoneNumber,
            member.avatar ?? null,
          ],
        );
      }
    }

    for (const event of state.events) {
      const startsAtIso = toIsoString(event.date) ?? new Date().toISOString();
      const createdAtIso = toIsoString(event.createdAt) ?? new Date().toISOString();
      const updatedAtIso = toIsoString(event.updatedAt) ?? createdAtIso;
      const rsvpDeadlineIso = toIsoString(event.rsvpDeadline);
      const linkExpiresAtIso = toIsoString(event.linkExpiresAt);
      const lastNudgeAtIso = toIsoString(event.lastNudgeAt);
      await client.query(
        `
          INSERT INTO app_event(
            scope,
            id,
            title,
            description,
            starts_at,
            time,
            location,
            created_by,
            invitation_link,
            invitation_code,
            link_expires_at,
            rsvp_deadline,
            last_nudge_at,
            reminder_enabled,
            created_at,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5::timestamptz, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz, $13::timestamptz, $14, $15::timestamptz, $16::timestamptz
          )
        `,
        [
          this.scope,
          event.id,
          String(event.title ?? '').trim() || 'Event',
          event.description ?? null,
          startsAtIso,
          String(event.time ?? '').trim() || '00:00',
          event.location ?? null,
          event.createdBy ?? 'unknown',
          event.invitationLink ?? null,
          event.invitationCode ?? null,
          linkExpiresAtIso,
          rsvpDeadlineIso,
          lastNudgeAtIso,
          Boolean(event.reminderEnabled),
          createdAtIso,
          updatedAtIso,
        ],
      );

      const participants = dedupeByPhone(event.participants ?? []);
      for (const participant of participants) {
        const respondedAtIso = toIsoString(participant.respondedAt);
        await client.query(
          `
            INSERT INTO app_event_participant(
              scope,
              event_id,
              user_id,
              name,
              phone_number,
              avatar,
              status,
              responded_at,
              is_late_response
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9)
          `,
          [
            this.scope,
            event.id,
            participant.userId ?? participant.phoneNumber,
            String(participant.name ?? '').trim() || 'Kontakt',
            participant.phoneNumber,
            participant.avatar ?? null,
            participant.status ?? 'pending',
            respondedAtIso,
            Boolean(participant.isLateResponse),
          ],
        );
      }

      for (const groupId of uniqueGroupIds(event.groups) ?? []) {
        await client.query(
          `
            INSERT INTO app_event_group(scope, event_id, group_id)
            VALUES ($1, $2, $3)
          `,
          [this.scope, event.id, groupId],
        );
      }
    }
  }

  async tryReadLegacySnapshot(client) {
    try {
      const result = await client.query(
        `SELECT payload FROM ${this.legacySnapshotTableName} WHERE scope = $1 LIMIT 1`,
        [this.scope],
      );
      if (!result.rowCount) {
        return null;
      }
      return result.rows[0].payload ?? null;
    } catch (error) {
      if (error && typeof error === 'object' && error.code === '42P01') {
        return null;
      }
      throw error;
    }
  }

  async ensureSeed(client) {
    await this.ensureSchema(client);
    const existingEvents = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM app_event
        WHERE scope = $1
      `,
      [this.scope],
    );
    if ((existingEvents.rows[0]?.count ?? 0) > 0) {
      return;
    }

    const legacy = await this.tryReadLegacySnapshot(client);
    const seedState = legacy && typeof legacy === 'object' ? legacy : createSeedData(this.publicBaseUrl, this.inviteSecret);
    await this.writeStateTx(client, seedState);
  }

  async withLockedState(mutator) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.ensureSchema(client);
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`social-cal:${this.scope}`]);
      await this.ensureSeed(client);
      const currentState = await this.readStateTx(client);
      const working = deepClone(currentState);
      const result = await mutator(working);
      await this.writeStateTx(client, working);
      await client.query('COMMIT');
      return deepClone(result);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listState() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.ensureSeed(client);
      const state = await this.readStateTx(client);
      await client.query('COMMIT');
      return deepClone(state);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getEventById(eventId) {
    return this.operations.getEventById(() => this.listState(), eventId);
  }

  async createEvent(input) {
    return this.operations.createEvent((mutator) => this.withLockedState((state) => mutator(state)), input);
  }

  async respondToInvitation(input) {
    return this.operations.respondToInvitation((mutator) => this.withLockedState((state) => mutator(state)), input);
  }

  async createGroup(input) {
    return this.operations.createGroup((mutator) => this.withLockedState((state) => mutator(state)), input);
  }

  async addMembersToGroup(groupId, members) {
    return this.operations.addMembersToGroup(
      (mutator) => this.withLockedState((state) => mutator(state)),
      groupId,
      members,
    );
  }

  async toggleEventReminder(eventId, reminderEnabled) {
    return this.operations.toggleEventReminder(
      (mutator) => this.withLockedState((state) => mutator(state)),
      eventId,
      reminderEnabled,
    );
  }

  async sendRsvpNudge(eventId) {
    return this.operations.sendRsvpNudge(
      (mutator) => this.withLockedState((state) => mutator(state)),
      eventId,
    );
  }

  async close() {
    await this.pool.end();
  }
}

export async function createDataRepository(config, options = {}) {
  if (config.dataStore !== 'postgres') {
    return new InMemoryDataRepository({
      publicBaseUrl: config.publicAppBaseUrl,
      inviteSecret: config.dataInviteSecret,
      seedState: options.seedState,
    });
  }

  const module = await import('pg');
  const Pool = module.Pool;
  const pool = options.pool
    ? options.pool
    : new Pool({
        connectionString: config.dataPostgresUrl,
        ssl: config.dataPostgresSsl ? { rejectUnauthorized: false } : undefined,
      });
  const repository = new PostgresDataRepository(pool, {
    publicBaseUrl: config.publicAppBaseUrl,
    inviteSecret: config.dataInviteSecret,
    scope: config.dataScope ?? DEFAULT_SCOPE,
    legacySnapshotTableName: config.dataTableName ?? 'app_data_state',
  });
  await repository.listState();
  return repository;
}
