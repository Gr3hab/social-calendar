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

CREATE INDEX IF NOT EXISTS idx_app_event_scope_starts_at ON app_event(scope, starts_at);
CREATE INDEX IF NOT EXISTS idx_app_event_participant_scope_phone ON app_event_participant(scope, phone_number);
