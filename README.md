# Plan It. - Social Calendar für Jugendliche 🎉

Eine moderne Web-App (2026-Design) für extrem einfachen Kalender für Jugendliche. Funktioniert über Telefonnummer und macht Termine per Link teilbar.

## ✨ Features

### MVP - Voll funktionsfähig
- **📱 Login per Telefonnummer** - SMS-Code (Mock-Service)
- **👤 Onboarding** - Name, Profilbild, Social Handles (Instagram, Snapchat, TikTok)
- **🏠 Startseite** - Liste der kommenden Termine mit schnellen Aktionen
- **📅 Kalenderansichten** - Monat & Woche mit visueller Event-Darstellung
- **➕ Event-Erstellung** - Titel, Datum, Uhrzeit, Ort, Beschreibung, Teilnehmer
- **👥 Teilnehmer-Management** - Telefonnummer eingeben oder aus Freundesliste wählen
- **🔗 Einladungslinks** - Unique URL pro Event für einfaches Teilen
- **📊 Öffentliche Event-Seite** - "Zusage"/"Absage", Teilnehmerliste, Live-Status
- **👫 Gruppen** - Erstelle Gruppen (Freunde, Sportteam, Klasse), füge Mitglieder hinzu
- **📆 Gruppen-Kalender** - Zeigt nur Events dieser Gruppe
- **🔔 Push-Reminder** - Mock-Funktion mit UI-Elementen
- **⚙️ Einstellungen** - Profil bearbeiten, Social-Handles ändern

### Zukünftige Features (Platzhalter implementiert)
- **📱 WhatsApp-Einladungen** - Automatische Einladungen via WhatsApp
- **📸 Social Media Login** - Instagram, Snapchat, TikTok Integration
- **📅 Google Calendar Sync** - OAuth-Integration
- **📆 Outlook Sync** - Microsoft Graph Integration
- **📄 ICS-Feed** - Kalender-Export für andere Apps

## 🎨 Design-Features

- **2026-Style** - Clean, modern, große Buttons, mobile-first
- **Snapchat-Simplicity + Google Calendar Klarheit** - Beste aus beiden Welten
- **Bottom Navigation** - Home, Kalender, Gruppen, Profil
- **Floating Action Button** - Schneller Termin erstellen (Long-press für Quick-Event)
- **Dark Mode** - Komplett integriert
- **Glassmorphism** - Moderne UI-Elemente mit Blur-Effekten
- **Gradient-Buttons** - Auffällige Call-to-Actions
- **Micro-Interactions** - Hover-Effekte, Animationen, Transitions

## 🛠️ Technik

### Frontend
- **React 19** mit TypeScript
- **Vite** für schnelles Development
- **TailwindCSS 4.1** mit modernen CSS-Features
- **React Router** für Navigation
- **date-fns** für Datumshandling
- **Heroicons** für Icons

### State Management
- **React Context API** - Leichtgewichtig und einfach
- **Custom Hooks** für saubere Logik-Trennung

### Backend-Simulation
- **Mock-API** - Einfache Simulation, später ersetzbar
- **LocalStorage** für Datenpersistenz im Browser
- **Platzhalter-Services** - Struktur für zukünftige Features

## 🚀 Quick Start

### Voraussetzungen
- Node.js 18+
- npm oder yarn

### Installation
```bash
# Projekt klonen
git clone <repository-url>
cd social-calendar

# Dependencies installieren
npm install

# Development Server starten
npm run dev
```

### Entwicklung
```bash
# Development mit Hot Reload
npm run dev

# Build für Production
npm run build

# Preview Production Build
npm run preview

# Tests
npm run test

# Linting
npm run lint
```

## 📱 Mobile Experience

Die App ist vollständig mobile-first optimiert:
- **Touch-optimierte** Buttons und Interaktionen
- **Safe Area Support** für moderne Smartphones
- **PWA-fähig** - Kann auf Home-Bildschirm installiert werden
- **Responsive Design** - Funktioniert auf allen Geräten

## 🔐 Authentifizierung

### Mock-Login
- **Telefonnummer**: Beliebige gültige Nummer eingeben
- **SMS-Code**: `123456` (Demo-Modus)
- **Keine Registrierung** - Direkter Einstieg

### Social Handles (Optional)
- Instagram, Snapchat, TikTok können im Onboarding hinzugefügt werden
- Später für Social Login und Freundesuche nutzbar

## 📂 Projektstruktur

```
src/
├── components/          # UI-Komponenten
│   ├── Layout.tsx      # Haupt-Layout mit Bottom Nav
│   ├── EventModal.tsx  # Event-Erstellung Modal
│   └── ...
├── pages/              # Seiten-Komponenten
│   ├── Login.tsx       # Login-Seite
│   ├── Home.tsx        # Startseite
│   ├── Calendar.tsx    # Kalender-Ansichten
│   ├── Groups.tsx      # Gruppen-Management
│   └── ...
├── context/            # React Context
│   ├── AuthContext.tsx # Authentifizierung
│   ├── DataContext.tsx # Daten-Management
│   └── AppContext.tsx  # App-Status
├── services/           # Services & APIs
│   ├── placeholderServices.ts # Zukünftige Features
│   └── ...
├── types/              # TypeScript Typen
└── assets/             # Statische Assets
```

## 🎯 Zielgruppe

- **Jugendliche 14-25 Jahre**
- **Social Media affine Nutzer**
- **Mobile-first Nutzer**
- **Menschen die einfache Lösungen bevorzugen**

## 🔄 Workflow

1. **Login** mit Telefonnummer
2. **Onboarding** mit Profil-Erstellung
3. **Events erstellen** über FAB
4. **Freunde einladen** per Telefonnummer oder Link
5. **Gruppen bilden** für wiederkehrende Events
6. **Kalender synchronisieren** (zukünftig)

---

## 📄 Advanced Features & Server Integration

Dieses Projekt enthält auch eine vollständige Server-Integration für Produktions-Deployment:

### Serverseitiges OTP (optional)

1. Auth-API starten (Terminal 1):

```bash
npm run server:dev
```

2. Frontend im API-Modus starten (Terminal 2):

```bash
npm run dev:auth
```

3. Healthcheck:

```bash
curl http://127.0.0.1:8787/api/auth/health
```

4. Echtes SMS-OTP (Twilio) konfigurieren:

```bash
AUTH_SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
AUTH_SMS_FROM=+1...
# alternativ:
# TWILIO_MESSAGING_SERVICE_SID=MG...
```

Rollout-Logik:
- `VITE_AUTH_MODE=mock` erzwingt Mock-Login (lokal stabil).
- `VITE_AUTH_MODE=api` erzwingt API-Login.
- Ohne expliziten Mode wird in `production` automatisch API genutzt.

## Schritt 1b: Persistente Daten (Events/RSVP/Gruppen)

Frontend auf Data-API umstellen:

```bash
VITE_DATA_MODE=api
VITE_DATA_API_BASE_URL=http://127.0.0.1:8787
```

Sicherheit:
- Private Data-Endpunkte (`/api/data/*`) akzeptieren nur Bearer-Tokens aus dem OTP-Login.
- Public RSVP nutzt signierte Invite-Links (`code` + `token`) und wird serverseitig validiert.

Postgres aktivieren:

```bash
DATA_STORE=postgres
DATA_POSTGRES_URL=postgres://user:password@127.0.0.1:5432/social_calendar
```

Schema-Migration:

```bash
psql "$DATA_POSTGRES_URL" -f server/migrations/001_app_data_state.sql
psql "$DATA_POSTGRES_URL" -f server/migrations/002_normalized_data_model.sql
```

## Schritt 2: Produktionshaerte (neu)

1. Server-Integrationstests (OTP, Lockout, Rate-Limits):

```bash
npm run test:server
```

2. Optional Redis statt In-Memory aktivieren:

```bash
AUTH_STORE=redis AUTH_REDIS_URL=redis://127.0.0.1:6379 npm run server:start
```

3. Optional Postgres für Data-API:

```bash
DATA_STORE=postgres DATA_POSTGRES_URL=postgres://... npm run server:start
```

## Qualitäts-Gates

```bash
npm test
npm run test:coverage
npm run lint
npm run build
```

## E2E (Playwright)

```bash
# einmalig Browser installieren
npx playwright install

# E2E ausführen
npm run test:e2e
```

Weitere Varianten:

```bash
npm run test:e2e:headed
npm run test:e2e:ui
```

## Neue Testbereiche

- `e2e/top-user-flow.spec.ts`  
  Login -> Onboarding -> Event erstellen -> Public RSVP -> No-Show-Nudge.
- `e2e/failure-paths.spec.ts`  
  Rate-Limit + Netzwerkfehler mit Retry-UX in realen UI-Flows.
- `tests/failure-resilience.test.tsx`  
  Integrationsnahe Failure-Tests (Netzwerk, Rate-Limit, Retry) für Login, RSVP, EventModal, Nudge.

## Produktionsreife

Konkrete Launch-Blocker und Maßnahmen:  
`docs/production-readiness-checklist.md`

## Server-Konfiguration

Siehe `.env.example` fuer:

- `VITE_AUTH_MODE`
- `VITE_AUTH_API_BASE_URL`
- `VITE_AUTH_PROXY_TARGET`
- `AUTH_STORE`
- `AUTH_REDIS_URL`
- `AUTH_API_SECRET`
- `AUTH_SMS_PROVIDER`
- `AUTH_SMS_FROM`
- `TWILIO_ACCOUNT_SID`
- `VITE_DATA_MODE`
- `VITE_DATA_API_BASE_URL`
- `DATA_STORE`
- `DATA_POSTGRES_URL`
- `DATA_INVITE_SECRET`
