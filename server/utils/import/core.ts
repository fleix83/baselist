// Gemeinsame Import-Logik: Dedup, Konto-Erzeugung, Upsert, Status-Pflege.
import { createHash } from 'node:crypto'
import { and, eq, ilike, sql } from 'drizzle-orm'
import { db, schema } from '../db'
import type { EventCategory } from '../../db/schema'
import { slugifyHandle } from '../handles'

export interface ImportedEventData {
  title: string
  startsAt: Date
  endsAt?: Date | null
  venueName?: string | null
  address?: string | null
  category?: EventCategory | null
  priceInfo?: string | null
  imageUrl?: string | null
  imageCopyright?: string | null
  sourceUrl: string // Pflicht: Link zur Originalquelle
  externalId: string
  cancelled?: boolean
}

export interface ImportStats {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

export function emptyStats(): ImportStats {
  return { created: 0, updated: 0, skipped: 0, errors: [] }
}

function normalizeForHash(value: string): string {
  return value
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

/** dedup_hash = normalisierter Titel + Datum (Europe/Zurich) + normalisierte Venue. */
export function computeDedupHash(title: string, startsAt: Date, venueName?: string | null): string {
  const day = startsAt.toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' })
  const raw = `${normalizeForHash(title)}|${day}|${normalizeForHash(venueName ?? '')}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

/** Freies Handle finden (base, base-2, base-3, …). */
export async function ensureUniqueHandle(base: string): Promise<string> {
  let candidate = base
  for (let i = 2; i < 100; i++) {
    const existing = await db
      .select({ id: schema.accounts.id })
      .from(schema.accounts)
      .where(eq(schema.accounts.handle, candidate))
      .limit(1)
    if (existing.length === 0) return candidate
    candidate = `${base}-${i}`
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`
}

/** Venue-Konto wiederverwenden (Wiedererkennung über Namen) oder anlegen. */
export async function ensureVenueAccount(name: string, address?: string | null): Promise<string> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Venue-Name leer')
  const [existing] = await db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(and(eq(schema.accounts.type, 'venue'), ilike(schema.accounts.displayName, trimmed)))
    .limit(1)
  if (existing) return existing.id

  const handle = await ensureUniqueHandle(slugifyHandle(trimmed, 40))
  const id = crypto.randomUUID()
  await db.insert(schema.accounts).values({
    id,
    handle,
    type: 'venue',
    displayName: trimmed,
    bio: address ?? null,
    trustLevel: 2,
  })
  return id
}

/**
 * Importiertes Event anlegen oder aktualisieren.
 * Dedup: 1) UNIQUE (source_id, external_id) für Updates aus derselben Quelle,
 * 2) dedup_hash quer über Quellen (bei Treffer aktualisieren statt duplizieren).
 */
export async function upsertImportedEvent(
  sourceId: string,
  data: ImportedEventData,
): Promise<'created' | 'updated'> {
  const dedupHash = computeDedupHash(data.title, data.startsAt, data.venueName)

  let [existing] = await db
    .select({ accountId: schema.events.accountId, status: schema.events.status })
    .from(schema.events)
    .where(and(eq(schema.events.sourceId, sourceId), eq(schema.events.externalId, data.externalId)))
    .limit(1)
  if (!existing) {
    ;[existing] = await db
      .select({ accountId: schema.events.accountId, status: schema.events.status })
      .from(schema.events)
      .where(eq(schema.events.dedupHash, dedupHash))
      .limit(1)
  }

  const venueAccountId = data.venueName ? await ensureVenueAccount(data.venueName, data.address) : null
  const now = new Date()
  const isPast = (data.endsAt ?? new Date(data.startsAt.getTime() + 4 * 60 * 60 * 1000)) < now
  const status = data.cancelled ? 'cancelled' : isPast ? 'past' : 'planned'

  if (existing) {
    // Nur mit vorhandenen Werten überschreiben, nie mit null "leeren"
    const updates: Record<string, unknown> = {
      startsAt: data.startsAt,
      endsAt: data.endsAt ?? null,
      dedupHash,
      status,
    }
    if (venueAccountId) updates.venueAccountId = venueAccountId
    if (data.address) updates.address = data.address
    if (data.category) updates.category = data.category
    if (data.priceInfo) updates.priceInfo = data.priceInfo
    if (data.imageUrl) {
      updates.imageUrl = data.imageUrl
      updates.imageCopyright = data.imageCopyright ?? null
    }
    if (data.sourceUrl) updates.sourceUrl = data.sourceUrl
    await db.update(schema.events).set(updates).where(eq(schema.events.accountId, existing.accountId))
    await db
      .update(schema.accounts)
      .set({ displayName: data.title })
      .where(eq(schema.accounts.id, existing.accountId))
    return 'updated'
  }

  const accountId = crypto.randomUUID()
  const handle = await ensureUniqueHandle(slugifyHandle(data.title, 40))
  await db.batch([
    db.insert(schema.accounts).values({
      id: accountId,
      handle,
      type: 'event',
      displayName: data.title,
      trustLevel: 2,
    }),
    db.insert(schema.events).values({
      accountId,
      startsAt: data.startsAt,
      endsAt: data.endsAt ?? null,
      venueAccountId,
      address: data.address ?? null,
      category: data.category ?? null,
      priceInfo: data.priceInfo ?? null,
      imageUrl: data.imageUrl ?? null,
      imageCopyright: data.imageCopyright ?? null,
      status,
      sourceId,
      sourceUrl: data.sourceUrl,
      externalId: data.externalId,
      dedupHash,
    }),
  ])
  return 'created'
}

/** Status-Übergang planned -> past beim Import-Lauf mitpflegen. */
export async function markPastEvents(): Promise<void> {
  await db.execute(sql`
    update events
    set status = 'past'
    where status = 'planned'
      and coalesce(ends_at, starts_at + interval '4 hours') < now()
  `)
}

/**
 * Kategorie-Zuordnung aus freiem Text (Rubrik-Namen, ICS-Kategorien …).
 * Nur an Wortanfängen matchen, sonst schlagen deutsche Komposita zu
 * ("Botanischer Garten" enthält "bar", "Umweltwissenschaften" enthält "wissenschaft").
 */
export function mapCategory(text: string | null | undefined): EventCategory | null {
  if (!text) return null
  const t = text.toLowerCase()
  if (/\b(musik|konzert|festival|jazz|klassik|chor|orchester|hip.?hop|electro|rock\b|pop\b|band\b)/.test(t)) return 'musik'
  if (/\b(party|club|nightlife|disco|rave|dj\b)/.test(t)) return 'nightlife'
  if (/\b(kunst|theater|ausstellung|museum|galerie|vernissage|film|kino|literatur|bühne|comedy|oper\b|opern|tanz\b)/.test(t)) return 'kunst'
  if (/\b(sport|turnier|fitness|yoga|wandern|velo|marathon|lauf\b)/.test(t)) return 'sport'
  if (/\b(vortrag|vorlesung|lesung|wissenschaft|diskussion|podium|referat|konferenz|tagung|kongress|seminar|workshop|symposium|infoveranstaltung|talk\b)/.test(t)) return 'talk'
  if (/\b(kulinari|food|degustation|brunch|dinner|essen\b|apéro|apero)/.test(t)) return 'essen'
  if (/\b(universität|campus|studierende|studium|hochschul|uni\b)/.test(t)) return 'campus'
  return null
}
