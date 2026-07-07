# Baselist

Lokale Social-Plattform für Basel: Event-Entdeckung plus sozialer Layer
(Folgen, Zusagen, Posts). Nuxt 3 + Tailwind + Drizzle + Neon Postgres +
Neon Auth, gehostet auf Vercel. Details: `Baselist_Implementierungsplan_Claude_Code.md`.

## Lokal starten

```bash
npm install
cp .env.example .env   # Werte eintragen (siehe unten)
npm run db:migrate     # Migrationen gegen die DB ausführen
npm run db:seed        # Dummy-Daten + Aggregations-Quellen
npm run dev            # http://localhost:3000
```

Import-Lauf manuell anstossen:

```bash
curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/import
```

## Environment-Variablen

Siehe `.env.example`. Kurzfassung:

| Variable | Zweck | Pflicht |
|---|---|---|
| `DATABASE_URL` | Neon-Pooler-URL | ja |
| `NEON_AUTH_BASE_URL` | Auth-Service-URL (Neon-Console → Auth) | ja |
| `CRON_SECRET` | schützt `/api/cron/import` | ja |
| `PUBLIC_BASE_URL` | absolute URL für OG-Tags | ja (Prod) |
| `ADMIN_EMAILS` | E-Mails, die beim Onboarding Admin werden | empfohlen |
| `EVENTFROG_API_KEY` | aktiviert den Eventfrog-Import | für Quelle 2 |
| `INFOMANIAK_API_TOKEN` / `INFOMANIAK_PRODUCT_ID` / `INFOMANIAK_MODEL` | AI-Moderation | empfohlen |
| `R2_*` | Bildupload (Cloudflare R2) | für Bilder |
| `BLOCKWORDS` | zusätzliche Sperrwörter | optional |

Ohne optionale Keys läuft die App trotzdem: Eventfrog wird übersprungen
(Status in `sources.last_status`), der AI-Check ist inaktiv (nur Log-Warnung),
der Bildupload ist ausgeblendet.

## Deployment (Vercel)

1. Repo bei Vercel importieren (Framework-Preset: Nuxt).
2. Alle Env-Variablen aus `.env` im Vercel-Projekt setzen —
   `PUBLIC_BASE_URL` auf die echte Domain.
3. `vercel.json` richtet den Import-Cron ein (alle 6 h); Vercel ruft die Route
   automatisch mit `Authorization: Bearer $CRON_SECRET` auf.
4. In der Neon-Console unter **Auth → Configuration → Domains** die
   Vercel-Domain als Trusted Origin eintragen (localhost ist erlaubt).
5. Für das tägliche DB-Backup das GitHub-Secret `DATABASE_URL` setzen
   (Action: `.github/workflows/backup.yml`).

## Nützliche Kommandos

```bash
npm run db:generate    # Migration aus Schemaänderung erzeugen
npm run db:migrate     # Migrationen ausführen
npm run db:seed        # Seed (idempotent)
node scripts/generate-icons.mjs  # PWA-Icons neu erzeugen
```

## Architektur-Leitplanken

- **Portabilität:** Standard-Postgres, versionierte Drizzle-Migrationen,
  DB-Zugriff nur über `server/utils/db.ts`. Umzugsplan: `MIGRATION.md`.
- **Auth-Abstraktion:** Sessions nur über `server/utils/auth.ts`
  (`getCurrentUser`, `requireUser`, `requireAdmin`); der Client spricht den
  eigenen Proxy `/api/auth/*`. Kein Auth-SDK im Code.
- **Moderation:** Kette in `server/utils/moderation.ts`
  (Rate-Limits → Sperrwörter → AI-Check), Admin-Queue unter `/admin`.
