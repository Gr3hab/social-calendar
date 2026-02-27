# 🚀 QUICK DEPLOY - 7 Minutes to Zero Data Leaks

## ✅ **VORBEREITUNG COMPLETE**

- ✅ Supabase CLI installiert (local)
- ✅ Dependencies installiert
- ✅ Security .gitignore updated
- ✅ Hardened Edge Functions ready
- ✅ Rate limiting schema ready
- ✅ Real security tests ready

---

## 🎯 **DEIN EXAKTER 7-MINUTEN RUNBOOK**

### **Step 0: .env erstellen (30 Sek)**
```bash
cp .env.example .env
# Editiere .env mit deinen echten Supabase Keys:
# VITE_SUPABASE_URL=https://your-project-ref.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_URL=https://your-project-ref.supabase.co
# SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (NUR lokal!)
```

### **Step 1: Supabase Dashboard (2 Min)**
1. **supabase.com** → New Project
2. **Auth → Email Magic Link** aktivieren
3. **Auth → Email + Password** auch aktivieren (für Tests!)
4. **Redirect URLs**: `http://localhost:3000`

### **Step 2: SQL Schema (1 Min)**
Im Supabase SQL Editor ausführen:
1. `supabase/schema.sql`
2. `supabase/rls.sql` (mit rate_limits security!)

### **Step 3: Secrets setzen (1 Min)**
```bash
npx supabase login
npx supabase link --project-ref <DEIN_PROJECT_REF>

npx supabase secrets set \
  ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173" \
  SUPABASE_URL="https://xxxx.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="xxxx"
```

### **Step 4: Functions deploy (2 Min)**
```bash
npx supabase functions deploy public-event-hardened --no-verify-jwt
npx supabase functions deploy rsvp-public-hardened --no-verify-jwt
```

### **Step 5: Security Tests (1 Min)**
```bash
node supabase/security-test-final.js
```

---

## 🎉 **ERWARTETES ERGEBNIS:**

```
🚀 Starting Security Tests...
✅ RLS core checks passed
✅ Edge function sanitized output OK
🎉 ALL GREEN - Zero Data Leaks Verified!
```

---

## 🔥 **WENN ETWAS SCHEITERT:**

### **A) signInWithPassword geht nicht**
→ Auth → Email + Password aktivieren

### **B) Profile Insert failt**
→ `profiles_insert_own` Policy checken

### **C) Rate Limit Fehler**
→ `rate_limits` Tabelle bereinigen

**Siehe `supabase/TROUBLESHOOTING.md` für alle Fixes!**

---

## ✅ **SUCCESS CLAIM:**

Wenn Tests grün sind, kannst du sagen:

> **"Zero data leaks verified via real-session RLS tests + hardened public Edge Functions (CORS whitelist + rate limiting + sanitized output)."**

---

## 🚀 **BEREIT FÜR LOVABLE:**

Nach ALL GREEN:
1. **Lovable Connect** Supabase
2. **Email Magic Link** Auth
3. **Hardened Functions** nutzen
4. **Production Ready** Security

**Drück den roten Knopf!** 😄🔴
