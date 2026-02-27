-- ========================================
-- PLAN IT. - Social Calendar Schema
-- ========================================

-- Extensions (meist in Supabase schon da, aber sicher ist sicher)
create extension if not exists pgcrypto;

-- Secure invitation code generator (muss vor events Tabelle existieren)
create or replace function public.gen_random_invitation_code()
returns text as $$
declare
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer;
begin
  for i in 1..12 loop
    result := result || substr(chars, (floor(random() * length(chars))::int + 1), 1);
  end loop;
  return result;
end;
$$ language plpgsql volatile;

-- USER PROFILE (ergänzt supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone_number text unique,
  avatar_url text,
  instagram_handle text,
  snapchat_handle text,
  tiktok_handle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- GROUPS
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- GROUP MEMBERS
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member','admin')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- EVENTS
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  group_id uuid references public.groups(id) on delete set null, -- optional: event belongs to a group
  visibility text not null default 'private' check (visibility in ('private','group','link')),
  invitation_code text unique default gen_random_invitation_code(), -- auto-generated secure code
  rsvp_deadline timestamptz,
  reminder_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint valid_event_times check (ends_at is null or ends_at >= starts_at)
);

-- Indexes für Performance
create index if not exists idx_events_group_id on public.events(group_id);
create index if not exists idx_events_created_by on public.events(created_by);
create index if not exists idx_events_starts_at on public.events(starts_at);
create index if not exists idx_events_invitation_code on public.events(invitation_code);

-- EVENT ATTENDEES (RSVP)
create table if not exists public.event_attendees (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'maybe' check (status in ('yes','no','maybe')),
  responded_at timestamptz not null default now(),
  is_late_response boolean not null default false,
  primary key (event_id, user_id)
);

-- PUBLIC INVITE RESPONSES (für Gäste ohne registrierten Account)
create table if not exists public.public_invite_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  phone_number text not null,
  display_name text not null,
  status text not null check (status in ('yes','no','maybe')),
  responded_at timestamptz not null default now(),
  is_late_response boolean not null default false,
  unique (event_id, phone_number)
);

-- Index für RSVP Queries
create index if not exists idx_event_attendees_event_id on public.event_attendees(event_id);
create index if not exists idx_event_attendees_user_id on public.event_attendees(user_id);
create index if not exists idx_public_invite_responses_event_id on public.public_invite_responses(event_id);
create index if not exists idx_public_invite_responses_status on public.public_invite_responses(status);

-- Trigger für updated_at auf profiles
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- Secure invitation code generator
-- Rate limiting table for Edge Functions
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null default 0
);

-- Index for rate limiting performance
create index if not exists idx_rate_limits_key_window on public.rate_limits(key, window_start);

-- Cleanup old rate limit entries (run periodically)
create or replace function public.cleanup_old_rate_limits()
returns void as $$
begin
  delete from public.rate_limits 
  where window_start < now() - interval '5 minutes';
end;
$$ language plpgsql;

-- ========================================
-- COMPLIANCE / YOUTH-SAFETY TABLES
-- ========================================

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  age_band text not null check (age_band in ('under_13', '13_15', '16_20', '21_plus')),
  consent_status text not null check (consent_status in ('blocked', 'required', 'granted', 'not_required')),
  consent_evidence_ref text,
  granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_consents_user_id on public.consents(user_id);

create trigger handle_consents_updated_at
  before update on public.consents
  for each row execute procedure public.handle_updated_at();

create table if not exists public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references public.profiles(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  invite_code text,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_abuse_reports_created_at on public.abuse_reports(created_at);
create index if not exists idx_abuse_reports_reporter on public.abuse_reports(reporter_user_id);

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'rejected')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_account_deletion_requests_user on public.account_deletion_requests(user_id, requested_at desc);

create table if not exists public.data_export_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  download_url text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_data_export_jobs_user on public.data_export_jobs(user_id, requested_at desc);
