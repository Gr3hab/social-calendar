-- ========================================
-- ROW LEVEL SECURITY (RLS) Policies
-- ========================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.public_invite_responses enable row level security;
alter table public.rate_limits enable row level security;
alter table public.consents enable row level security;
alter table public.abuse_reports enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.data_export_jobs enable row level security;

-- 🔒 Rate Limits: Nur Service Role Zugriff
revoke all on table public.rate_limits from anon;
revoke all on table public.rate_limits from authenticated;
-- Service Role umgeht RLS, aber anon/auth haben gar keine Rechte

-- ========================================
-- PROFILES POLICIES
-- ========================================

-- Profiles: jeder nur sich selbst sehen/bearbeiten
create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid());

create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles for insert
with check (id = auth.uid());

-- ========================================
-- GROUPS POLICIES
-- ========================================

-- Groups: sichtbar für Mitglieder + Creator
create policy "groups_select_member_or_creator"
on public.groups for select
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.group_members gm
    where gm.group_id = groups.id and gm.user_id = auth.uid()
  )
);

create policy "groups_insert_creator"
on public.groups for insert
with check (created_by = auth.uid());

-- Groups: nur Creator kann updaten/löschen
create policy "groups_update_creator"
on public.groups for update
using (created_by = auth.uid());

create policy "groups_delete_creator"
on public.groups for delete
using (created_by = auth.uid());

-- ========================================
-- GROUP MEMBERS POLICIES (BOMBENSICHER)
-- ========================================

-- Group Members: Mitgliederliste nur für Mitglieder
create policy "group_members_select_if_member"
on public.group_members for select
using (
  exists (
    select 1 from public.group_members gm
    where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
  )
);

-- Group Members: NUR Group-Admins dürfen Mitglieder hinzufügen
create policy "group_members_insert_if_admin"
on public.group_members for insert
with check (
  exists (
    select 1 from public.group_members gm
    where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
      and gm.role = 'admin'
  )
);

-- Group Members: User kann sich selbst entfernen ODER Admin darf entfernen
create policy "group_members_delete_self_or_admin"
on public.group_members for delete
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.group_members gm
    where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
      and gm.role = 'admin'
  )
);

-- Group Members: Update nur für Admins (z.B. role ändern)
create policy "group_members_update_if_admin"
on public.group_members for update
using (
  exists (
    select 1 from public.group_members gm
    where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
      and gm.role = 'admin'
  )
);

-- ========================================
-- EVENTS POLICIES
-- ========================================

-- Events: Creator immer; Group-Events für Group-Mitglieder; Private Events nur für Creator
create policy "events_select_creator_or_group_member"
on public.events for select
using (
  created_by = auth.uid()
  or (
    visibility = 'group'
    and group_id is not null
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = events.group_id and gm.user_id = auth.uid()
    )
  )
  or (
    visibility = 'private'
    and created_by = auth.uid()
  )
  -- visibility='link' wird über separate Edge Function gehandhabt
);

create policy "events_insert_creator"
on public.events for insert
with check (created_by = auth.uid());

create policy "events_update_creator"
on public.events for update
using (created_by = auth.uid());

create policy "events_delete_creator"
on public.events for delete
using (created_by = auth.uid());

-- ========================================
-- EVENT ATTENDEES POLICIES
-- ========================================

-- RSVP: User kann eigene Antworten verwalten
create policy "attendees_upsert_own"
on public.event_attendees for insert
with check (user_id = auth.uid());

create policy "attendees_update_own"
on public.event_attendees for update
using (user_id = auth.uid());

create policy "attendees_delete_own"
on public.event_attendees for delete
using (user_id = auth.uid());

-- RSVP: Antworten sichtbar für Event-Creator und Gruppenmitglieder (NICHT für fremde User!)
create policy "attendees_select_own_or_event_creator"
on public.event_attendees for select
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.events e
    where e.id = event_attendees.event_id and e.created_by = auth.uid()
  )
  -- Gruppenmitglieder können RSVPs von Gruppen-Events sehen
  or (
    exists (
      select 1 from public.events e
      join public.group_members gm on gm.group_id = e.group_id
      where e.id = event_attendees.event_id 
        and e.visibility = 'group'
        and gm.user_id = auth.uid()
    )
  )
);

-- Public invite responses: nur Event-Creator darf lesen
create policy "public_invite_responses_select_event_creator"
on public.public_invite_responses for select
using (
  exists (
    select 1
    from public.events e
    where e.id = public_invite_responses.event_id
      and e.created_by = auth.uid()
  )
);

-- ========================================
-- COMPLIANCE / SAFETY POLICIES
-- ========================================

create policy "consents_select_own"
on public.consents for select
using (user_id = auth.uid());

create policy "consents_insert_own"
on public.consents for insert
with check (user_id = auth.uid());

create policy "consents_update_own"
on public.consents for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "abuse_reports_insert_own"
on public.abuse_reports for insert
with check (reporter_user_id = auth.uid());

create policy "abuse_reports_select_own"
on public.abuse_reports for select
using (reporter_user_id = auth.uid());

create policy "account_deletion_requests_insert_own"
on public.account_deletion_requests for insert
with check (user_id = auth.uid());

create policy "account_deletion_requests_select_own"
on public.account_deletion_requests for select
using (user_id = auth.uid());

create policy "data_export_jobs_insert_own"
on public.data_export_jobs for insert
with check (user_id = auth.uid());

create policy "data_export_jobs_select_own"
on public.data_export_jobs for select
using (user_id = auth.uid());
