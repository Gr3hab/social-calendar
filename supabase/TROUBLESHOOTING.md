# 🔥 TROUBLESHOOTING - Die 3 häufigsten WTF-Fehler

## ❌ **A) `signInWithPassword` geht nicht**

**Fehler:** `{"error":{"message":"Invalid login credentials"}}`

**Ursache:** Email+Password Provider nicht aktiviert
**Fix:** 
1. Supabase Dashboard → Authentication → Providers → Email
2. **"Enable email password"** aktivieren
3. **"Enable email confirmation"** AUS lassen (für Magic Link)

---

## ❌ **B) Profile Insert failt trotz Policy**

**Fehler:** `{"code":"42501","message":"new row violates row-level security policy"}`
  
**Ursache:** `profiles.insert` Policy fehlt oder `with check` nicht sauber
**Fix:** Policy muss existieren und strikt sein:

```sql
-- Diese Policy muss vorhanden sein:
create policy "profiles_insert_own"
on public.profiles for insert
with check (id = auth.uid());
```

---

## ❌ **C) User kann sich in fremde Gruppen "reinupserten"**

**Fehler:** User kann beliebige Gruppen beitreten
**Ursache:** `group_members` Insert Policy zu permissiv
**Fix:** Nur Creator darf einfügen, User darf sich selbst entfernen:

```sql
create policy "group_members_manage_by_creator"
on public.group_members for all
using (
  exists (
    select 1 from public.groups g
    where g.id = group_members.group_id and g.created_by = auth.uid()
  )
  -- User kann sich selbst aus Gruppen entfernen (aber nicht einfügen!)
  or (user_id = auth.uid() and tg_op = 'DELETE')
);
```

---

## 🔍 **DEBUGGING CHECKLIST**

### **1. RLS wirklich aktiv?**
```sql
-- Check ob RLS enabled ist:
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('profiles','groups','events','event_attendees','rate_limits');
```

### **2. Policies vorhanden?**
```sql
-- Alle Policies auflisten:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

### **3. User Session korrekt?**
```sql
-- JWT simulieren für Tests:
select set_config('request.jwt.claim.sub', 'USER_UUID_HERE', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
```

---

## 🚨 **EDGE FUNCTION FEHLER**

### **CORS Fehler**
**Fehler:** `No 'Access-Control-Allow-Origin' header`
**Fix:** `ALLOWED_ORIGINS` Secret setzen

### **Rate Limit Fehler**
**Fehler:** `{"error":"rate_limited"}`
**Fix:** `rate_limits` Tabelle bereinigen:

```sql
DELETE FROM public.rate_limits WHERE window_start < now() - interval '5 minutes';
```

### **Service Role Key Fehler**
**Fehler:** `Invalid service_role key`
**Fix:** Secret korrekt setzen:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

---

## 🎯 **SUCCESS INDICATORS**

Wenn alles passt, siehst du:

```
🚀 Starting Security Tests...
✅ RLS core checks passed
✅ Edge function sanitized output OK
🎉 ALL GREEN - Zero Data Leaks Verified!
```

---

## 💡 **PRO-TIPPS**

1. **Immer SQL Editor + Real Tests kombinieren**
2. **Service Role Key NIE ins Frontend**
3. **Rate Limits regelmäßig aufräumen**
4. **CORS Origins whitelisten**
5. **Logs im Supabase Dashboard checken**

---

**Wenn du einen Fehler siehst:**
1. **Genauen Fehler posten**
2. **Welcher Schritt** (Schema/RLS/Functions/Tests)
3. **User UUID** (falls relevant)

**Dann fixen wir das in 2 Minuten!** 🚀
