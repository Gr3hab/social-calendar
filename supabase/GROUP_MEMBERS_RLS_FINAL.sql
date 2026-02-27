-- ========================================
-- BOMBENSICHERE GROUP MEMBERS RLS
-- ========================================

-- GROUP MEMBERS RLS (SELECT/INSERT/UPDATE/DELETE)

alter table public.group_members enable row level security;

-- SELECT: nur Mitglieder der Gruppe
create policy "gm_select_if_member"
on public.group_members for select
using (
  exists (
    select 1 from public.group_members gm
    where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
  )
);

-- INSERT: nur Admins dürfen hinzufügen
create policy "gm_insert_if_admin"
on public.group_members for insert
with check (
  exists (
    select 1 from public.group_members gm
    where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
      and gm.role = 'admin'
  )
);

-- UPDATE: nur Admins dürfen Rollen ändern
create policy "gm_update_if_admin"
on public.group_members for update
using (
  exists (
    select 1 from public.group_members gm
    where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
      and gm.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.group_members gm
    where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
      and gm.role = 'admin'
  )
);

-- DELETE: man darf sich selbst entfernen ODER Admin darf entfernen
create policy "gm_delete_self_or_admin"
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

-- ========================================
-- RATE LIMIT TABLE ENDGÜLTICHT DICHT
-- ========================================

alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon;
revoke all on table public.rate_limits from authenticated;

-- ========================================
-- OPTIONAL: Last Admin Protection Trigger
-- ========================================

-- Verhindert dass der letzte Admin sich selbst entfernt/demoted
create or replace function public.prevent_last_admin_removal()
returns trigger as $$
declare
  admin_count integer;
begin
  -- Bei DELETE: prüfen ob dies der letzte Admin ist
  if TG_OP = 'DELETE' then
    select count(*) into admin_count
    from public.group_members
    where group_id = OLD.group_id and role = 'admin';
    
    if admin_count <= 1 then
      raise exception 'Cannot remove the last admin from group';
    end if;
  end if;
  
  -- Bei UPDATE: prüfen ob Admin zu Member downgraded und ob dies der letzte Admin wäre
  if TG_OP = 'UPDATE' then
    if OLD.role = 'admin' and NEW.role != 'admin' then
      select count(*) into admin_count
      from public.group_members
      where group_id = NEW.group_id and role = 'admin' and user_id != NEW.user_id;
      
      if admin_count < 1 then
        raise exception 'Cannot demote the last admin in group';
      end if;
    end if;
  end if;
  
  return coalesce(NEW, OLD);
end;
$$ language plpgsql;

-- Trigger für Admin-Schutz
create trigger prevent_last_admin_removal_trigger
  before update or delete on public.group_members
  for each row execute procedure public.prevent_last_admin_removal();
