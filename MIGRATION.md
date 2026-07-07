# Migrationspfad: Neon → Supabase

Dieses Dokument beschreibt den Umzugsplan (nicht bauen, nur dokumentieren –
Phase 8 des Implementierungsplans). Stand: Juli 2026.

## Betroffene Bausteine im Überblick

| Baustein | Heute (MVP) | Nach Migration | Aufwand |
|---|---|---|---|
| Datenbank | Neon Postgres (HTTP-Treiber) | Supabase Postgres | Dump/Restore + 1 Datei |
| Schema/Migrationen | Drizzle-SQL-Migrationen im Repo | identisch, laufen 1:1 | keiner |
| Auth | Neon Auth (gehosteter Better-Auth-Service) | Supabase Auth | 2 Dateien + Nutzer-Export |
| Bildspeicher | Cloudflare R2 | R2 behalten (empfohlen) oder Supabase Storage | 0 bzw. 1 Datei |
| Auto-Moderation | Infomaniak AI Tools | unverändert | keiner |
| Hosting/Cron | Vercel + Vercel Cron | unverändert | keiner |

Das Schema ist reines Standard-Postgres (keine Neon-Extensions, kein pg_cron),
alle Schemaänderungen liegen als versionierte SQL-Migrationen in
`server/db/migrations/`.

## 1. Daten umziehen (Schema + Inhalte)

```bash
# Export aus Neon (Custom-Format, ohne Owner/Privileges)
pg_dump "$NEON_DATABASE_URL" --no-owner --no-privileges -Fc -f baselist.dump

# Import in Supabase (Connection-String aus dem Supabase-Dashboard)
pg_restore --no-owner --no-privileges -d "$SUPABASE_DATABASE_URL" baselist.dump
```

Hinweise:
- Das `neon_auth`-Schema (Better-Auth-Tabellen des gehosteten Diensts) NICHT
  mitnehmen – Auth-Nutzer werden separat migriert (siehe 2).
  Bei Bedarf: `pg_dump --exclude-schema=neon_auth …`
- Danach in `.env` nur `DATABASE_URL` tauschen. Der DB-Zugriff läuft zentral
  über `server/utils/db.ts`; dort ggf. den Treiber wechseln
  (`drizzle-orm/neon-http` → `drizzle-orm/postgres-js` mit `postgres`-Paket) –
  das ist der einzige Codeberührungspunkt der Datenbank-Migration.
- Tages-Backups liegen als GitHub-Action-Artifacts vor (`.github/workflows/backup.yml`).

## 2. Auth tauschen (Neon Auth → Supabase Auth)

Dank Abstraktionsschicht (Leitplanke 2.2) sind nur zwei Stellen betroffen:

1. **`server/utils/auth.ts`** – einzige Datei, die Sessions beim Auth-Dienst
   nachschlägt (`fetchAuthUser` ruft heute `{NEON_AUTH_BASE_URL}/get-session`).
   Neu: Supabase-Session validieren (JWT aus dem `sb-…-auth-token`-Cookie via
   `@supabase/ssr` oder JWKS-Check). `getCurrentUser`, `requireUser`,
   `requireAdmin` bleiben in Signatur und Verhalten identisch.
2. **`server/api/auth/[...path].ts`** – der Proxy zum Neon-Auth-Service
   entfällt bzw. wird durch Supabase-Auth-Endpoints ersetzt. Die Client-Seite
   (`composables/useAuth.ts`) ruft heute Better-Auth-REST-Pfade
   (`/sign-in/email`, `/sign-up/email`, `/email-otp/*`) – diese Funktionen auf
   `supabase.auth.signInWithPassword()` etc. umstellen.

Die App-Tabelle `users` referenziert Auth-Nutzer über `auth_user_id` (Text).
Beim Umzug die Supabase-User-IDs in `users.auth_user_id` nachführen
(Mapping über die E-Mail-Adresse).

## 3. Bekannte Reibung: Passwort-Hashes

Neon Auth (Better Auth) exponiert Passwort-Hashes nicht per Export-UI; selbst
wenn Hashes via `neon_auth.account` zugänglich sind, ist das Format
(scrypt/bcrypt-Varianten) nicht 1:1 mit Supabase kompatibel.

**Pragmatischer Plan (bei kleiner Nutzerzahl unkritisch):**
1. Nutzer per E-Mail-Liste in Supabase Auth anlegen (`admin.createUser`,
   `email_confirm: true`).
2. Allen Betroffenen eine Passwort-Reset-Mail schicken
   (`supabase.auth.resetPasswordForEmail`).
3. Kurze Info-Notiz beim Login («Wir sind umgezogen – bitte Passwort neu setzen»).

## 4. Storage-Entscheid

- **Empfehlung: R2 behalten.** Bild-URLs in `accounts.avatar_url`,
  `events.image_url`, `posts.image_url` sind absolute R2-URLs und bleiben
  gültig; kein Umzug nötig.
- Falls doch Supabase Storage: Dateien aus dem R2-Bucket kopieren (rclone),
  URLs in den drei Spalten per SQL-Update umschreiben, und
  `server/utils/storage.ts` (einzige Upload-Stelle) auf Supabase Storage
  umstellen.

## 5. Reihenfolge am Umzugstag

1. Schreibzugriffe pausieren (Vercel-Deployment mit Wartungshinweis reicht).
2. `pg_dump` → `pg_restore` (Punkt 1).
3. Supabase-Auth-Nutzer anlegen + `users.auth_user_id` mappen (Punkt 2/3).
4. `server/utils/auth.ts`, `server/api/auth/[...path].ts`,
   `composables/useAuth.ts`, `.env` umstellen.
5. Smoke-Test: Login, Posten, Zusagen, `/api/health`, `/api/cron/import`
   (mit `x-cron-secret`).
6. Reset-Mails verschicken, Wartungshinweis entfernen.
