-- ========================================
-- SECURITY TESTS - RLS Smoke Test
-- ========================================
-- Führe diese Tests in Supabase SQL Editor aus
-- Simuliere verschiedene User und teste Policies

-- ========================================
-- TEST 1: User A (UUID ersetzen)
-- ========================================
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- SOLLTE FUNKTIONIEREN:
select * from public.profiles where id = '00000000-0000-0000-0000-000000000001';
select * from public.groups where created_by = '00000000-0000-0000-0000-000000000001';

-- SOLLTE NICHT FUNKTIONIEREN (leeres Ergebnis):
select * from public.profiles where id = '00000000-0000-0000-0000-000000000002';
select * from public.groups where created_by = '00000000-0000-0000-0000-000000000002';

-- ========================================
-- TEST 2: User B (UUID ersetzen)
-- ========================================
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- SOLLTE FUNKTIONIEREN:
select * from public.profiles where id = '00000000-0000-0000-0000-000000000002';

-- SOLLTE NICHT FUNKTIONIEREN:
select * from public.profiles where id = '00000000-0000-0000-0000-000000000001';

-- ========================================
-- TEST 3: Group Membership Test
-- ========================================
-- Erstelle Test-Daten (nur für Test!)
insert into public.profiles (id, display_name) values 
  ('00000000-0000-0000-0000-000000000001', 'User A'),
  ('00000000-0000-0000-0000-000000000002', 'User B')
on conflict (id) do nothing;

insert into public.groups (id, name, created_by) values 
  ('11111111-1111-1111-1111-111111111111', 'Test Group', '00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.group_members (group_id, user_id, role) values 
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'admin'),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'member')
on conflict (group_id, user_id) do nothing;

-- Teste als User A (Creator)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- SOLLTE FUNKTIONIEREN (Creator sieht Group):
select * from public.groups where id = '11111111-1111-1111-1111-111111111111';
select * from public.group_members where group_id = '11111111-1111-1111-1111-111111111111';

-- Teste als User B (Member)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- SOLLTE FUNKTIONIEREN (Member sieht Group):
select * from public.groups where id = '11111111-1111-1111-1111-111111111111';
select * from public.group_members where group_id = '11111111-1111-1111-1111-111111111111';

-- ========================================
-- TEST 4: Event RSVP Test
-- ========================================
-- Erstelle Test Event
insert into public.events (id, title, starts_at, created_by, visibility) values 
  ('22222222-2222-2222-2222-222222222222', 'Test Event', now(), '00000000-0000-0000-0000-000000000001', 'private')
on conflict (id) do nothing;

-- RSVP von User B
insert into public.event_attendees (event_id, user_id, status) values 
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000002', 'yes')
on conflict (event_id, user_id) do update set status = 'yes';

-- Teste als User A (Creator)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- SOLLTE FUNKTIONIEREN (Creator sieht alle RSVPs):
select * from public.event_attendees where event_id = '22222222-2222-2222-2222-222222222222';

-- Teste als User B (Attendee)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- SOLLTE FUNKTIONIEREN (User sieht eigene RSVP):
select * from public.event_attendees where 
  event_id = '22222222-2222-2222-2222-222222222222' 
  and user_id = '00000000-0000-0000-0000-000000000002';

-- SOLLTE NICHT FUNKTIONIEREN (User sieht nicht fremde RSVPs):
select * from public.event_attendees where 
  event_id = '22222222-2222-2222-2222-222222222222' 
  and user_id != '00000000-0000-0000-0000-000000000002';

-- ========================================
-- CLEANUP (Test-Daten entfernen)
-- ========================================
delete from public.event_attendees where event_id = '22222222-2222-2222-2222-222222222222';
delete from public.events where id = '22222222-2222-2222-2222-222222222222';
delete from public.group_members where group_id = '11111111-1111-1111-1111-111111111111';
delete from public.groups where id = '11111111-1111-1111-1111-111111111111';
delete from public.profiles where id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

-- Reset JWT context
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
