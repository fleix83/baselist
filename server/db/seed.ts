// Seed-Skript für die lokale Entwicklung: Dummy-Konten, -Events, -Posts
// und die beiden Aggregations-Quellen. Aufruf: npm run db:seed
import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const client = neon(process.env.DATABASE_URL!)
const db = drizzle(client, { schema })

async function seed() {
  console.log('Seeding …')

  // Aggregations-Quellen (Phase 3 nutzt sie; enabled steuert den Cron-Lauf).
  // sources.name hat keinen Unique-Constraint, deshalb Existenz-Check statt onConflict.
  const existingSources = await db.select({ name: schema.sources.name }).from(schema.sources)
  const existingNames = new Set(existingSources.map((s) => s.name))
  const sourceValues = [
      {
        name: 'Eventfrog Basel',
        kind: 'eventfrog',
        config: {
          // Basel-Stadt PLZ-Bereich; Umkreis-Fallback via lat/lng/r
          zips: ['4000', '4001', '4051', '4052', '4053', '4054', '4055', '4056', '4057', '4058', '4059'],
          lat: 47.5596,
          lng: 7.5886,
          radiusKm: 6,
        },
        enabled: true,
      },
      {
        name: 'Uni Basel Veranstaltungskalender',
        kind: 'unibas',
        config: {
          rssUrl:
            'https://www.unibas.ch/eventsFeeds/de?field=&type=&month=&year=&query=&path=/de/Aktuell/Veranstaltungen',
          icalPattern: 'https://www.unibas.ch/.rest/export/v1/ical/{id}.ics',
          defaultCategory: 'campus',
        },
        enabled: true,
      },
  ].filter((s) => !existingNames.has(s.name))
  if (sourceValues.length > 0) {
    await db.insert(schema.sources).values(sourceValues as (typeof schema.sources.$inferInsert)[])
  }

  // Dummy-Konten
  const [venue] = await db
    .insert(schema.accounts)
    .values({
      handle: 'kaserne-basel',
      type: 'venue',
      displayName: 'Kaserne Basel',
      bio: 'Kulturzentrum auf dem Kasernenareal.',
      verified: true,
      trustLevel: 3,
    })
    .onConflictDoNothing()
    .returning()

  const [organizer] = await db
    .insert(schema.accounts)
    .values({
      handle: 'skuba',
      type: 'organizer',
      displayName: 'skuba – Studierendenschaft Uni Basel',
      bio: 'Die Studierendenschaft der Universität Basel.',
      verified: true,
      trustLevel: 3,
    })
    .onConflictDoNothing()
    .returning()

  const eventDefs = [
    {
      handle: 'semesterstart-party-2026',
      displayName: 'Semesterstart-Party',
      category: 'nightlife' as const,
      daysFromNow: 7,
      price: 'CHF 10 / Studis gratis',
      address: 'Klybeckstrasse 1b, 4057 Basel',
    },
    {
      handle: 'flohmarkt-petersplatz',
      displayName: 'Flohmarkt am Petersplatz',
      category: 'sonstiges' as const,
      daysFromNow: 3,
      price: 'gratis',
      address: 'Petersplatz, 4051 Basel',
    },
    {
      handle: 'jazz-im-park',
      displayName: 'Jazz im Park',
      category: 'musik' as const,
      daysFromNow: 1,
      price: 'Kollekte',
      address: 'Schützenmattpark, 4054 Basel',
    },
  ]

  for (const def of eventDefs) {
    const [eventAccount] = await db
      .insert(schema.accounts)
      .values({
        handle: def.handle,
        type: 'event',
        displayName: def.displayName,
        trustLevel: 1,
      })
      .onConflictDoNothing()
      .returning()

    if (eventAccount) {
      const startsAt = new Date(Date.now() + def.daysFromNow * 24 * 60 * 60 * 1000)
      await db
        .insert(schema.events)
        .values({
          accountId: eventAccount.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 3 * 60 * 60 * 1000),
          venueAccountId: venue?.id ?? null,
          address: def.address,
          category: def.category,
          priceInfo: def.price,
          description: `${def.displayName} – Dummy-Event aus dem Seed-Skript.`,
          createdByAccountId: organizer?.id ?? null,
        })
        .onConflictDoNothing()
    }
  }

  // Ein Dummy-Post des Veranstalters
  if (organizer) {
    await db
      .insert(schema.posts)
      .values({
        authorAccountId: organizer.id,
        body: 'Willkommen auf Baselist! Hier findet ihr ab sofort, was in Basel läuft.',
      })
      .onConflictDoNothing()
  }

  const counts = await db.execute(sql`
    select
      (select count(*) from accounts) as accounts,
      (select count(*) from events) as events,
      (select count(*) from posts) as posts,
      (select count(*) from sources) as sources
  `)
  console.log('Fertig:', counts.rows[0])
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error(err)
  process.exit(1)
})
