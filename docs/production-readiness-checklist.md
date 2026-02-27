# Produktions-Readiness-Checkliste (Launch-Gate)

Stand: 18. Februar 2026  
Scope: Social Calendar MVP (Web, U20-Fokus)

## 1) Harte Launch-Blocker (muss vor Go-Live grün sein)

| Bereich | Blocker | Warum kritisch | Konkrete Maßnahme vor Launch |
|---|---|---|---|
| Auth/Security | OTP-Backend vorhanden, aber Prod-Credentials/Secret-Management noch nicht finalisiert | Ohne echte Provider-Keys kein verlässlicher Login | Twilio-Provider in Prod aktivieren, Secrets in Vault/CI verwalten, `AUTH_EXPOSE_DEBUG_CODE=false`, Smoke-Test nach Deploy |
| Abuse/Rate-Limits | Kein serverseitiges Rate-Limit/Device-Fingerprinting | Spam, Brute Force, SMS-Kostenexplosion | API-Gateway-Limits pro IP/Phone, progressive Backoff, Captcha-Schutz auf Auth-Endpunkten |
| Datenhaltung | Normalisiertes Schema ist da, aber noch ohne dedizierte Analytics-/Backoffice-Readmodelle | Last/Reporting können Produktivbetrieb ausbremsen | Read-Optimierung (Materialized Views), Lasttests, Zero-Downtime-Migrationsstrategie |
| Link-Sicherheit | Signierte Invite-Token + serverseitige Prüfung vorhanden, aber kein One-Time-/Passcode-Schutz | Weiterleitbare Links können weiterhin unkontrolliert geteilt werden | Optionaler Passcode/One-Time-Link für sensible Events, Abuse-Detection auf Public-RSVP |
| Datenschutz/DSGVO | Keine produktive Einwilligungs- und Löschprozesse | Rechtliches Risiko bei Minderjährigen-Daten | Consent-Flows, DPA, Lösch-API, Datenexport, Aufbewahrungsfristen |
| Monitoring | Kein produktives Error/Performance-Monitoring | Probleme werden zu spät erkannt | Sentry + OpenTelemetry + Uptime-Checks + Alerting (PagerDuty/Slack) |
| Rollback | Keine dokumentierte Release-/Rollback-Strategie | Längerer Ausfall bei fehlerhaftem Deploy | Blue/Green oder Canary-Deploy, versionierte DB-Migrationen, 1-Klick-Rollback |

## 2) Wichtige Quality-Gates (soll vor Launch grün sein)

- E2E-Kernflows (`test:e2e`) stabil in CI auf Chromium Desktop + Mobile.
- Contract-Tests für API-Fehlercodes (`NETWORK_ERROR`, `RATE_LIMITED`, `VALIDATION_ERROR`).
- Lighthouse mobile: Performance > 85, Accessibility > 90.
- Security-Scans (`npm audit`, SAST, Secret-Scan) ohne kritische Findings.
- Incident-Runbook mit On-Call-Kontakten und SLA für RSVP/Auth-Ausfälle.

## 3) Privacy & Youth-Safety Mindeststandard

- Telefonnummern in Logs maskieren (`+49*******123`).
- Klare Minderjährigen-Hinweise in Terms/Privacy.
- Missbrauchsmelde-Flow für öffentliche Eventseiten.
- Optional: Host-Moderation (Teilnehmer ausblenden/entfernen).

## 4) Operative Readiness (Tag-0)

- Produktions-Konfiguration getrennt von Mock-Flags.
- Feature-Flags für riskante Features (Public RSVP, Link-Freigabe).
- Datenbank-Backups + Restore-Test erfolgreich.
- Release-Checklist im CI-Workflow als Pflicht-Gate.

## 5) Aktueller Projektstatus (heute)

- Lokal: `npm test`, `npm run test:coverage`, `npm run lint`, `npm run build` sind grün.
- Neu ergänzt: Playwright-E2E für Top-Flow + Failure-Pfade.
- Neu ergänzt: Fehler-/Retry-UX für Login, RSVP, Event-Erstellung und Nudge-Aktionen.
- Neu ergänzt: serverseitiges OTP+Rate-Limit mit SMS-Provider-Adapter (Mock/Twilio) in `server/authServer.mjs` + `server/smsProviders.mjs` inkl. optionalem Redis-Store.
- Neu ergänzt: Data-API für Events/RSVP/Gruppen mit optionaler Postgres-Persistenz (`DATA_STORE=postgres`) auf normalisiertem Schema (`server/migrations/002_normalized_data_model.sql`) inkl. Legacy-Import aus Snapshot-Tabelle.
- Neu ergänzt: Server-Integrationstests fuer Auth-Hardening (`tests/server-auth.integration.test.ts`).
- Neu ergänzt: Private Data-API mit Bearer-Auth + Public-Invite-Hardening (signierte `code`/`token`-Links, serverseitige Validierung).
- **Nicht produktionsreif ohne Backend-Sicherheits- und Datenschutz-Blocker aus Abschnitt 1.**
