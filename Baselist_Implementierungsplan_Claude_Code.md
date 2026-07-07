# Baselist MVP: Implementierungsplan für Claude Code

**Version:** 1.0 · **Datum:** Juli 2026 · **Basiert auf:** Baselist PRD v0.1
**Zielgruppe dieses Dokuments:** Claude Code (agentischer Coding-Assistent), gesteuert von Felix (Solo, Non-Developer, Vibecoding)

---

## 0. Kontext und Ziel

Baselist ist eine lokale Social-Plattform für Basel: Event-Entdeckung plus sozialer Layer (Folgen, Zusagen, Posts). Das MVP startet mit automatisch aggregierten Events (Eventfrog, Uni Basel) und ermöglicht Nutzern Konten, Folgen, Zusagen und eigene Posts/Events. Launch-Wedge: Studierende der Uni Basel, getimt auf den Semesterstart Mitte September.

**Erfolgskriterium des MVP:** Eine einzelne Person ohne Netzwerk öffnet die App und sieht sofort, was diese Woche in Basel läuft. Registrierte Nutzer können folgen, zusagen und posten.

---

## 1. Stack (fixiert)

| Baustein | Wahl | Anmerkung |
|---|---|---|
| Frontend/Backend | Nuxt 3 (Vue), TypeScript, Nitro Server Routes | eine Codebase |
| Styling | Tailwind CSS | |
| Datenbank | Neon Postgres (Free Plan) | MVP; Produktion später Supabase |
| ORM/Migrationen | Drizzle ORM + drizzle-kit | portable SQL-Migrationen |
| Auth | Neon Auth (basiert auf Better Auth) | hinter Abstraktionsschicht, siehe 2.2 |
| Bildspeicher | Cloudflare R2 (S3-kompatibel) | keine Bilder in der DB |
| Auto-Moderation | Infomaniak AI Tools API, Modell Mistral Small 4 (Fallback: Mistral Small 3.2) | OpenAI-kompatible API, Daten bleiben in der Schweiz |
| Hosting | Vercel (Free) | inkl. Vercel Cron für Aggregation |
| Fehler-Monitoring | Sentry (Free) oder schlichtes Logging | leichtgewichtig halten |

**Nicht bauen (Out of Scope, siehe PRD):** Direktnachrichten, Ticketing, Empfehlungsalgorithmus, gehostetes Video (nur Links/Embeds), aktive Föderation (nur föderationsbereites Schema), Aggregation DE/FR, Mehrsprachigkeit (MVP ist Deutsch).

---

## 2. Leitplanken für Claude Code

### 2.1 Portabilität (Neon → Supabase)

- Nur Standard-Postgres verwenden. Keine Neon-spezifischen Features (kein Neon-eigenes Branching im Schema, keine Neon-only Extensions).
- Alle Schemaänderungen ausschliesslich über Drizzle-Migrationen (SQL-Dateien im Repo, versioniert).
- Zugriff über eine zentrale DB-Client-Datei (`server/utils/db.ts`), damit der Connection-Swap später eine Zeile ist.

### 2.2 Auth-Abstraktion

- Sämtlicher Auth-Zugriff läuft über `server/utils/auth.ts` mit einer schmalen Schnittstelle: `getCurrentUser(event)`, `requireUser(event)`, `requireAdmin(event)`.
- Kein direkter Import des Neon-Auth-SDK ausserhalb dieser Datei und der Auth-Routen/Komponenten.
- Vor Implementierung die aktuelle Neon-Auth-Dokumentation lesen (https://neon.com/docs/guides/neon-auth), da sich das SDK ändern kann.

### 2.3 Arbeitsweise

- Phasen strikt nacheinander. Eine Phase gilt erst als fertig, wenn ihre Abnahmekriterien erfüllt sind.
- Kleine, thematische Commits mit klaren Messages.
- `.env.example` pflegen, echte Secrets nie committen.
- Bei externen APIs (Eventfrog, Infomaniak, Neon Auth) immer zuerst die aktuelle Doku konsultieren statt aus dem Gedächtnis zu implementieren.
- Bei Unklarheiten Felix fragen statt raten, besonders bei Produktentscheidungen.

### 2.4 Von Felix bereitzustellen (Checkliste)

- [ ] Neon-Projekt erstellt, `DATABASE_URL` vorhanden
- [ ] Neon Auth im Projekt aktiviert, Keys vorhanden
- [ ] Eventfrog API-Key beantragt (Eventfrog Public API)
- [ ] Infomaniak AI Tools: API-Token und Product-ID (im Manager prüfen, ob Mistral Small 4 im Katalog ist, sonst Small 3.2 verwenden)
- [ ] Cloudflare R2 Bucket plus Access Keys
- [ ] Vercel-Projekt verbunden
- [ ] `CRON_SECRET` (beliebiger langer String) gesetzt

### 2.5 Environment-Variablen (`.env.example`)

```
DATABASE_URL=
NEON_AUTH_...=            # gemäss aktueller Neon-Auth-Doku
EVENTFROG_API_KEY=
INFOMANIAK_API_TOKEN=
INFOMANIAK_PRODUCT_ID=
INFOMANIAK_MODEL=mistral-small-4   # Fallback: mistral-small-3.2, exakten Modellnamen aus Katalog übernehmen
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=baselist-media
R2_PUBLIC_URL=
CRON_SECRET=
```

---

## 3. Datenmodell (Kern)

Zentrale Designentscheidung aus dem PRD: **Alles Folgbare ist ein Konto** (Person, Event, Venue, Veranstalter, Business/Institution), und das Schema ist **föderationsbereit** (Handle plus Heimat-Instanz), ohne dass Föderation gebaut wird.

Skizze der Tabellen (Details darf Claude Code sinnvoll ausgestalten, die Grundstruktur ist verbindlich):

```sql
-- Einheitliches Kontomodell
accounts (
  id uuid PK,
  handle text UNIQUE NOT NULL,            -- lokal eindeutig
  home_instance text NOT NULL DEFAULT 'baselist',  -- föderationsbereit
  type text NOT NULL,                     -- 'person' | 'event' | 'venue' | 'organizer' | 'business'
  display_name text NOT NULL,
  bio text,
  avatar_url text,
  verified boolean NOT NULL DEFAULT false,
  trust_level int NOT NULL DEFAULT 0,     -- 0 = neu, steigt mit Zeit/Verhalten
  created_at timestamptz NOT NULL DEFAULT now()
)

-- Verknüpfung Auth-User <-> Personen-Konto
users (
  auth_user_id text PK,                   -- ID aus Neon Auth
  account_id uuid UNIQUE NOT NULL REFERENCES accounts,
  email text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
)

-- Event-Erweiterung eines Kontos vom Typ 'event'
events (
  account_id uuid PK REFERENCES accounts,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  venue_account_id uuid REFERENCES accounts,  -- verlinkt, nie imitiert
  address text,
  category text,                          -- 'musik' | 'nightlife' | 'kunst' | 'sport' | 'talk' | 'essen' | 'campus' | 'sonstiges'
  price_info text,                        -- inkl. 'gratis'
  status text NOT NULL DEFAULT 'planned', -- 'planned' | 'live' | 'past' | 'cancelled'
  source_id uuid REFERENCES sources,      -- null = nutzererstellt
  source_url text,                        -- Link zur Originalquelle (Pflicht bei Aggregation)
  external_id text,                       -- ID in der Quelle, für Updates
  dedup_hash text,                        -- normalisiert(titel)+datum+venue
  created_by_account_id uuid REFERENCES accounts,
  UNIQUE (source_id, external_id)
)

-- Posts (News-Layer und Event-Updates)
posts (
  id uuid PK,
  author_account_id uuid NOT NULL REFERENCES accounts,
  subject_account_id uuid REFERENCES accounts,  -- z.B. Post "am" Event
  body text,
  image_url text,
  link_url text,                          -- Video/Links nur als Embed
  moderation_status text NOT NULL DEFAULT 'visible',  -- 'visible' | 'limited' | 'held' | 'removed'
  created_at timestamptz NOT NULL DEFAULT now()
)

follows (follower_account_id, followed_account_id, created_at, PK (beide))
rsvps   (user_account_id, event_account_id, state, created_at, PK (user, event))
        -- state: 'saved' | 'going'

-- Aggregation
sources (id uuid PK, name text, kind text, config jsonb, enabled boolean, last_run_at timestamptz, last_status text)
        -- kind: 'eventfrog' | 'ical'

-- Moderation
reports (id uuid PK, reporter_account_id, target_kind, target_id, reason, note, status, created_at)
        -- reason: 'spam' | 'hate' | 'illegal' | 'fake_event' | 'other'; status: 'open' | 'resolved'
moderation_log (id uuid PK, actor, action, target_kind, target_id, note, created_at)
rate_limits (account_id, action, window_start, count, PK (account_id, action, window_start))
```

Indizes mindestens auf: `events(starts_at)`, `events(category)`, `posts(author_account_id, created_at)`, `follows(follower_account_id)`, `reports(status)`.

---

## 4. Phasenplan

### Phase 0: Projekt-Setup

Nuxt 3 mit TypeScript initialisieren, Tailwind, Drizzle plus drizzle-kit, Verbindung zu Neon, Basis-Layout (Header, drei Tabs als Platzhalter: Feed, Entdecken, Agenda), Deploy-Skeleton auf Vercel, `.env.example`.

**Abnahme:** App läuft lokal und auf Vercel, DB-Verbindung steht (Health-Check-Route `/api/health` liest aus der DB).

### Phase 1: Datenmodell und Migrationen

Schema aus Abschnitt 3 als Drizzle-Schema plus erste Migration. Seed-Skript mit ein paar Dummy-Konten und -Events für die lokale Entwicklung.

**Abnahme:** `drizzle-kit` Migration läuft sauber gegen Neon durch, Seed-Daten sichtbar per einfacher Test-Query.

### Phase 2: Auth und Profile

Neon Auth einrichten (aktuelle Doku lesen). Registrierung und Login (E-Mail-Bestätigung aktiv). Beim ersten Login: Personen-Konto anlegen (Handle wählen, Anzeigename). Profilseite `/@handle` für alle Kontotypen (zeigt Posts, bei Events die Event-Infos). Auth-Abstraktion gemäss 2.2.

**Abnahme:** Registrieren, Handle wählen, einloggen, eigenes Profil sehen. Auth-SDK wird nur in `server/utils/auth.ts` und den Auth-Routen importiert.

### Phase 3: Aggregations-Engine

- `sources`-Verwaltung (zunächst per Seed/SQL, kein UI nötig).
- **Eventfrog-Importer:** Public API, Filter auf Region Basel (PLZ 4000er-Bereich mit Umkreis). Übernommen werden nur Fakten: Titel, Zeiten, Ort, Kategorie, Preis-Info, Bild-URL samt mitgeliefertem Copyright-Hinweis, Link zur Quelle. Keine fremden Beschreibungstexte kopieren. Aktuelle API-Doku vor Implementierung lesen.
- **iCal-Importer:** generisch (Paket `node-ical` o.ä.), erste Quelle: Veranstaltungskalender der Uni Basel. Konfigurierbare Feed-URLs in `sources.config`.
- **Konto-Erzeugung:** Importer legt pro Event ein Event-Konto an, pro Venue (falls identifizierbar) ein Venue-Konto, wiederverwendet bei Wiedererkennung.
- **Dedup:** `dedup_hash` aus normalisiertem Titel plus Datum plus Venue; bei Treffer aktualisieren statt duplizieren. `UNIQUE (source_id, external_id)` für Updates aus derselben Quelle.
- **Cron:** Nitro-Route `/api/cron/import`, abgesichert per `CRON_SECRET`-Header, ausgelöst durch Vercel Cron (z.B. alle 6 Stunden). Wichtig: kein pg_cron, Neon skaliert auf null.
- Status-Übergang `planned -> past` beim Import-Lauf mitpflegen.

**Abnahme:** Ein Cron-Lauf füllt die DB mit echten Basler Events aus beiden Quellen, ohne Duplikate bei erneutem Lauf. Jedes aggregierte Event hat einen Quell-Link.

### Phase 4: Die drei Ansichten (lesend)

- **Entdecken:** kuratierte Schienen statt Endlos-Feed: "Heute", "Dieses Wochenende", "Gratis", "Beim Campus" (Kategorie campus oder Nähe Petersplatz), "Neu dazugekommen". Filter nach Kategorie. Event-Karten mit Titel, Zeit, Ort, Bild, Zusage-Zahl.
- **Event-Detailseite:** alle Infos, Quell-Link, Venue-Verlinkung, Folgen- und Zusagen-Buttons (Buttons erst in Phase 5 aktiv).
- **Agenda:** eigene gespeicherte/zugesagte Events, sortiert nach Eventdatum (leerer Zustand mit Hinweis).
- **Folge-Feed:** Posts gefolgter Konten, sortiert nach Posting-Zeit (leerer Zustand mit Onboarding-Hinweis "Folge Konten aus Entdecken").
- Onboarding nach Registrierung: Interessen-Häkchen (Kategorien), die Entdecken vorfiltern.

**Abnahme:** Nicht eingeloggte Besucher sehen Entdecken voll funktionsfähig (Single-Player-Nutzen). Eingeloggte sehen alle drei Tabs.

### Phase 5: Sozialer Layer (schreibend)

- Folgen/Entfolgen für alle Kontotypen.
- Zusagen (`going`) und Speichern (`saved`), Zahlen auf Event-Karten.
- Posts erstellen: Text, optional ein Bild (Upload zu R2, clientseitig verkleinern), optional Link (YouTube/Instagram als Embed rendern, kein Hosting).
- Eigenes Event erstellen (Formular): erzeugt Event-Konto, Ersteller bleibt als Autor sichtbar, Venue nur verlinkbar, nie als Venue posten (keine Imitation).
- Folge-Feed wird damit lebendig.

**Abnahme:** Zwei Test-Nutzer können sich folgen, Posts sehen, einem Event zusagen, ein eigenes Event erstellen. Reichweitenlogik: Events unverifizierter Konten erscheinen im Folge-Feed der Follower, aber noch nicht in Entdecken-Schienen (ausser "Neu dazugekommen" nach Moderations-OK).

### Phase 6: Moderation

- **Rate-Limits:** z.B. max. 5 Posts und 2 Events pro Stunde für Konten mit `trust_level` 0, grosszügiger ab höherem Level. Zentral in einer Server-Utility.
- **Sperrwortliste:** einfache konfigurierbare Liste, Treffer setzt `held`.
- **AI-Check:** Nitro-Utility `moderateContent(text)`, ruft Infomaniak (OpenAI-kompatibler Chat-Completions-Endpoint, Base-URL und exakten Modellnamen aus der aktuellen Infomaniak-Doku) mit striktem System-Prompt: antworte nur mit JSON `{"severity":"ok"|"unsure"|"severe","categories":[...]}` (Kategorien: hate, harassment, sexual, violence, illegal, spam). Mapping: ok -> `visible`, unsure -> `limited` plus Report-Queue, severe -> `held`. API-Fehler: Inhalt `visible` lassen, aber in Queue legen (Fail-open mit Sichtung, keine harten Ausfälle für Nutzer).
- **Melden:** Report-Button an Post, Event, Profil mit den Gründen aus dem Schema. Ab 3 unabhängigen offenen Reports automatisch `limited` bis zur Sichtung.
- **Admin-Backend `/admin`:** nur `is_admin`. Eine Queue (offene Reports plus automatisch markierte Inhalte, nach Schwere sortiert) mit Aktionen: freigeben, entfernen, Reichweite begrenzen, Konto verwarnen/sperren. Jede Aktion ins `moderation_log`. E-Mail- oder Log-Benachrichtigung bei `severe`.

**Abnahme:** Ein Test-Post mit klar problematischem Inhalt landet in `held` und in der Queue; ein gemeldeter Post erscheint in der Queue; Admin-Aktionen wirken und werden geloggt.

### Phase 7: Launch-Härtung (Semesterstart)

- Impressum und Datenschutzerklärung (Seiten anlegen, Texte liefert Felix).
- Community-Regeln als öffentliche Seite, verlinkt bei Registrierung und Melden.
- SEO/OG-Tags für Event-Seiten (geteilte Links sehen gut aus in WhatsApp).
- PWA-Manifest plus Icons (installierbar, kein Offline-Anspruch).
- Mobile-Feinschliff: die drei Tabs als Bottom-Navigation, Karten touch-tauglich.
- Seeding-Lauf mit studi-relevanten Quellen prüfen (Uni-Kalender liefert, Kategorien stimmen).
- Basis-Monitoring (Sentry Free oder strukturierte Logs) und tägliches DB-Backup via `pg_dump` (GitHub Action reicht).

**Abnahme:** Lighthouse Mobile ohne rote Werte, ein geteilter Event-Link rendert Vorschau in WhatsApp, Backup-Action läuft.

### Phase 8: Nicht bauen, nur dokumentieren: Migrationspfad zu Supabase

Eine `MIGRATION.md` im Repo mit dem Umzugsplan: `pg_dump`/`pg_restore` des Schemas und der Daten, Auth-Tausch (Neon Auth raus, Supabase Auth rein, nur `server/utils/auth.ts` und Auth-Routen betroffen), Storage-Entscheid (R2 behalten oder Supabase Storage), bekannte Reibung Passwort-Hashes (ggf. Passwort-Reset-Mail an alle, bei kleiner Nutzerzahl unkritisch).

**Abnahme:** Dokument existiert und benennt jeden betroffenen Baustein.

---

## 5. Definition of Done (MVP gesamt)

- Anonymer Besucher sieht in Entdecken echte, aktuelle Basler Events aus mindestens zwei automatisierten Quellen, mit Quell-Links.
- Registrierung, Handle, Profil, Folgen, Zusagen, Posten (Text/Bild), eigenes Event erstellen funktionieren.
- Drei Ansichten mit korrekter Sortierlogik (Feed nach Posting-Zeit, Agenda nach Eventdatum).
- Moderationskette aktiv: Rate-Limits, Wortliste, AI-Check, Melden, Admin-Queue mit Log.
- Alles auf Gratis-Tarifen lauffähig (Neon Free, Vercel Free, R2 Free, Infomaniak nutzungsbasiert im Rappenbereich).
- Portabilität gewahrt: Standard-Postgres, versionierte Migrationen, Auth hinter Abstraktion, `MIGRATION.md` vorhanden.

---

*Referenz für alle Produktfragen ist das Baselist PRD v0.1. Bei Widersprüchen zwischen diesem Plan und dem PRD gilt das PRD, und Felix entscheidet.*
