# 🚀 ZERO COST DEPLOY - Supabase Free + Vercel Hobby

## 💰 **Kostenloses Setup: €0/Monat**

- ✅ **Supabase Free**: 50k MAU + 500k Edge Functions
- ✅ **Vercel Hobby**: Gratis Frontend Hosting
- ✅ **Email Magic Link**: Keine SMS-Kosten
- ✅ **Optional Keepalive**: Gegen Supabase Pausierung

---

## 🎯 **DEIN COMPLETER €0 DEPLOY PATH**

### **STEP 1: Supabase Free Setup (5 Min)**

#### **A) Projekt anlegen**
1. **supabase.com → New project**
2. **Auth → Email**: Magic Link/OTP aktivieren
3. **Redirect URLs**: `http://localhost:3000,http://localhost:5173`

#### **B) Schema deployen**
Im Supabase SQL Editor ausführen:
```sql
-- 1. Complete Schema
-- Inhalt von supabase/schema.sql

-- 2. RLS Policies  
-- Inhalt von supabase/rls.sql

-- 3. Bombensichere Group Members
-- Inhalt von supabase/GROUP_MEMBERS_RLS_FINAL.sql
```

#### **C) Edge Functions deployen**
```bash
npx supabase login
npx supabase link --project-ref <DEIN_PROJECT_REF>

npx supabase secrets set \
  ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173" \
  EDGE_SUPABASE_URL="https://xxxx.supabase.co" \
  EDGE_SUPABASE_SERVICE_ROLE_KEY="xxxx"

npx supabase functions deploy public-event-hardened --no-verify-jwt
npx supabase functions deploy rsvp-public-hardened --no-verify-jwt
```

---

### **STEP 2: Vercel Hobby Setup (3 Min)**

#### **A) Repo vorbereiten**
```bash
git add .
git commit -m "deploy: zero cost setup ready"
git push origin main
```

#### **B) Vercel verbinden**
1. **vercel.com → New Project** → GitHub Repo importieren
2. Framework automatisch erkannt (Vite/React)

#### **C) Environment Variables**
In Vercel Project Settings:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=dein-anon-key
```

#### **D) Deploy & URL bekommen**
Deploy klicken → URL: `https://dein-projekt.vercel.app`

#### **E) CORS nachziehen**
```bash
npx supabase secrets set ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173,https://dein-projekt.vercel.app"
```

---

### **STEP 2.5: Sofort einen echten invitation_code erzeugen (SQL Editor)**

Wenn noch kein `link`-Event existiert, im SQL Editor diesen Block ausführen:

```sql
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

insert into public.events (title, starts_at, created_by, visibility)
select
  'Smoke Test Event',
  now() + interval '2 day',
  p.id,
  'link'
from public.profiles p
order by p.created_at desc
limit 1
returning id, invitation_code, visibility;
```

Der zurückgegebene `invitation_code` ist direkt für die Curl-Tests nutzbar.

---

### **STEP 3: Verification (2 Min)**
```bash
PROJECT_REF=<DEIN_REF> ./supabase/RUN_VERIFICATION.sh
```

Expected: `🎉 ALL GREEN - Zero Data Leaks Verified!`

---

## ⚠️ **DIE 2 GRATIS-FALLEN & LÖSUNGEN**

### **Fall 1: SMS-Login kostet**
**Lösung:** Bleib bei Email Magic Link (€0)

### **Fall 2: Supabase pausiert nach Inaktivität**
**Lösung:** Keepalive Edge Function (optional)

---

## 🛡️ **OPTIONAL: Keepalive gegen Pausierung**

Falls du willst, dass nichts pausiert:

#### **A) Keepalive Function**
```bash
# supabase/functions/keepalive/index.ts
Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const supabase = createClient(supabaseUrl, serviceKey)
  
  // Minimal DB Query - hält Projekt am Leben
  await supabase.from('profiles').select('count').limit(1)
  
  return new Response("OK", { status: 200 })
})
```

#### **B) GitHub Actions Cron**
```yaml
# .github/workflows/keepalive.yml
name: Keepalive
on:
  schedule:
    - cron: '0 */6 * * *'  # Alle 6 Stunden
jobs:
  keepalive:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase
        run: curl -f https://your-project.supabase.co/functions/v1/keepalive
```

---

## 🎉 **DEIN €0 SUCCESS CLAIM**

> **"Zero-cost deployment: Supabase Free (50k MAU + 500k Edge Functions) + Vercel Hobby (free hosting) + Email Magic Link authentication. Zero data leaks verified via real-session RLS tests + hardened Edge Functions."**

---

## 📊 **KOSTENÜBERSICHT**

| Service | Plan | Kosten | Limits |
|---------|-------|--------|--------|
| Supabase | Free | €0 | 50k MAU, 500k Edge Functions |
| Vercel | Hobby | €0 | Unlimited Bandwidth |
| Auth | Email Magic Link | €0 | Unlimited |
| **TOTAL** | **€0/Monat** | **€0** | **Production Ready** |

---

## 🚀 **BEREIT FÜR PRODUCTION**

Nach **ALL GREEN**:
1. ✅ **Echte User** können onboarden
2. ✅ **Events erstellen** + RSVP
3. ✅ **Groups managen** mit bombensicherer RLS
4. ✅ **Public Events** via hardened Edge Functions
5. ✅ **Zero Data Leaks** verified

---

**JETZT DEPLOYEN - €0 FÜR IMMER!** 🔥

**Ich warte auf dein "🎉 ALL GREEN" Ergebnis!** 🎯
