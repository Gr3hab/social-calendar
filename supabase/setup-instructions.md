# 🚀 Supabase Setup für Plan It.

## 📋 Schritt-für-Schritt Anleitung

### 1. Supabase Projekt erstellen
1. Gehe zu [supabase.com](https://supabase.com)
2. Klicke "Start your project"
3. Wähle Organization (oder erstelle neue)
4. Projektname: `plan-it-calendar`
5. Database Password: Sicher speichern!
6. Region: Wähle die nächstgelegene (z.B. EU West)

### 2. Schema importieren
1. Im Supabase Dashboard → SQL Editor
2. Kopiere den Inhalt von `supabase/schema.sql`
3. Führe das SQL aus (✅ Schema wird erstellt)

### 3. RLS Policies aktivieren
1. Im gleichen SQL Editor
2. Kopiere den Inhalt von `supabase/rls.sql`
3. Führe das SQL aus (✅ Security aktiviert)

### 4. Auth konfigurieren (Email Magic Link)
1. Supabase Dashboard → Authentication → Settings
2. **Site URL**: `http://localhost:3000` (für Entwicklung)
3. **Redirect URLs**: 
   - `http://localhost:3000`
   - `https://deine-domain.com` (später für Production)
4. **Email Provider**: Supabase (kostenlos)
5. **Enable email confirmations**: AUS (für Magic Link不需要)

### 5. Edge Functions deployen
```bash
# Supabase CLI installieren (falls nicht vorhanden)
npm install -g supabase

# Login
supabase login

# Mit Projekt verbinden
supabase link --project-ref YOUR_PROJECT_REF

# Edge Functions deployen
supabase functions deploy public-event
supabase functions deploy rsvp-public
```

### 6. Environment Variablen
Erstelle `.env.local`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

### 7. Testen
```bash
# Development starten
npm run dev
```

**Test Flow:**
1. Email eingeben → Magic Link erhalten
2. Login → Profil erstellen
3. Event erstellen
4. Einladungslink kopieren
5. In neuem Tab öffnen → RSVP testen

## 🔧 Troubleshooting

### RLS nicht aktiv?
```sql
-- Manuell aktivieren
alter table public.profiles enable row level security;
-- ... für alle Tabellen wiederholen
```

### Edge Functions nicht erreichbar?
```bash
# Logs checken
supabase functions serve --no-verify-jwt

# Neu deployen
supabase functions deploy public-event --no-verify-jwt
```

### Magic Link kommt nicht?
1. Check Spam-Ordner
2. Email Provider überprüfen
3. Redirect URLs prüfen

## 🎯 Nächste Schritte

### Für Lovable Integration:
1. **Supabase Connection**: In Lovable "Connect Supabase" wählen
2. **Tables**: Alle Tabellen werden automatisch erkannt
3. **Authentication**: Email Magic Link als Default
4. **Edge Functions**: Public Event & RSVP Flow

### Für React Native (später):
1. **Supabase JS Client**: Bereits konfiguriert
2. **Auth**: `signInWithOtp({ email })`
3. **Queries**: React Query oder SWR
4. **Realtime**: Supabase Realtime für Live Updates

## 💡 Pro-Tips

### Security:
- ✅ RLS aktiviert
- ✅ Nur Creator kann Events löschen
- ✅ Group Members nur für Gruppenmitglieder
- ✅ Public Events nur via Edge Function

### Performance:
- ✅ Indexes auf wichtigen Spalten
- ✅ Timestamptz für Zeitzonen
- ✅ Cascading Deletes für Datenintegrität

### Skalierbarkeit:
- ✅ Supabase Auto-scaling
- ✅ Edge Functions für Public Access
- ✅ Realtime Subscriptions möglich

---

**Du bist jetzt bereit für Lovable!** 🚀
