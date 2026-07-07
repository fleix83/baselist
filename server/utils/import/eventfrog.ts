// Eventfrog-Importer (Public API v1, Bearer-Auth).
// Übernimmt nur Fakten: Titel, Zeiten, Ort, Kategorie, Preis-Info, Bild samt
// Copyright, Link zur Quelle. Keine fremden Beschreibungstexte.
import { emptyStats, mapCategory, upsertImportedEvent, type ImportStats } from './core'
import type { schema } from '../db'

const API_BASE = 'https://api.eventfrog.net/public/v1'

interface EventfrogEvent {
  id: string
  rubricId: number
  title: Record<string, string | null>
  url: string
  begin: string
  end?: string | null
  cancelled: boolean
  visible: boolean
  published: boolean
  soldOut: boolean
  agendaEntryOnly: boolean
  lowestTicketPrice?: number | null
  locationIds: string[]
  emblemToShow?: { url: string } | null
  emblemCredits?: string | null
}

interface EventfrogLocation {
  id: string
  title: Record<string, string | null>
  addressLine?: string | null
  zip?: string | null
  city?: string | null
}

function pickLang(obj: Record<string, string | null> | undefined | null): string | null {
  if (!obj) return null
  return obj.de ?? obj.en ?? Object.values(obj).find((v) => v) ?? null
}

async function efFetch<T>(path: string, params: URLSearchParams, apiKey: string): Promise<T> {
  const res = await globalThis.fetch(`${API_BASE}${path}?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    throw new Error(`Eventfrog ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  }
  return (await res.json()) as T
}

export async function importEventfrog(source: typeof schema.sources.$inferSelect): Promise<ImportStats> {
  const stats = emptyStats()
  const apiKey = process.env.EVENTFROG_API_KEY
  if (!apiKey) {
    stats.errors.push('EVENTFROG_API_KEY nicht gesetzt – Quelle übersprungen')
    return stats
  }
  const cfg = source.config as {
    zips?: string[]
    lat?: number
    lng?: number
    radiusKm?: number
    horizonDays?: number
  }

  const today = new Date().toISOString().slice(0, 10)
  const to = new Date(Date.now() + (cfg.horizonDays ?? 90) * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  // Events seitenweise laden (Filter: Region Basel via PLZ oder Umkreis)
  const events: EventfrogEvent[] = []
  const perPage = 500
  for (let page = 1; page <= 10; page++) {
    const params = new URLSearchParams()
    params.set('from', today)
    params.set('to', to)
    params.set('country', 'CH')
    params.set('perPage', String(perPage))
    params.set('page', String(page))
    if (cfg.zips?.length) {
      for (const zip of cfg.zips) params.append('zip', zip)
    } else if (cfg.lat && cfg.lng && cfg.radiusKm) {
      params.set('lat', String(cfg.lat))
      params.set('lng', String(cfg.lng))
      params.set('r', String(cfg.radiusKm))
    }
    const data = await efFetch<{ totalNumberOfResources: number; events: EventfrogEvent[] }>(
      '/events', params, apiKey,
    )
    events.push(...(data.events ?? []))
    if (page * perPage >= data.totalNumberOfResources) break
  }

  // Venues nachladen (Batches à 100 IDs)
  const locationIds = [...new Set(events.flatMap((e) => e.locationIds ?? []))]
  const locations = new Map<string, EventfrogLocation>()
  for (let i = 0; i < locationIds.length; i += 100) {
    const params = new URLSearchParams()
    for (const id of locationIds.slice(i, i + 100)) params.append('id', id)
    const data = await efFetch<{ locations: EventfrogLocation[] }>('/locations', params, apiKey)
    for (const loc of data.locations ?? []) locations.set(loc.id, loc)
  }

  // Rubriken für die Kategorie-Zuordnung
  const rubricTitles = new Map<number, string>()
  try {
    const data = await efFetch<{ rubrics: { id: number; title: Record<string, string | null> }[] }>(
      '/rubrics', new URLSearchParams(), apiKey,
    )
    for (const rubric of data.rubrics ?? []) {
      const title = pickLang(rubric.title)
      if (title) rubricTitles.set(rubric.id, title)
    }
  } catch (err) {
    stats.errors.push(`Rubriken nicht ladbar: ${String(err).slice(0, 120)}`)
  }

  for (const ev of events) {
    try {
      if (!ev.visible || !ev.published) {
        stats.skipped++
        continue
      }
      const title = pickLang(ev.title)
      if (!title || !ev.begin || !ev.url) {
        stats.skipped++
        continue
      }
      const loc = ev.locationIds?.map((id) => locations.get(id)).find(Boolean)
      const address = loc
        ? [loc.addressLine, [loc.zip, loc.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
        : null

      let priceInfo: string | null = null
      if (ev.soldOut) priceInfo = 'ausverkauft'
      else if (ev.lowestTicketPrice === 0) priceInfo = 'gratis'
      else if (ev.lowestTicketPrice != null) priceInfo = `ab CHF ${ev.lowestTicketPrice}`

      const result = await upsertImportedEvent(source.id, {
        title,
        startsAt: new Date(ev.begin),
        endsAt: ev.end ? new Date(ev.end) : null,
        venueName: loc ? pickLang(loc.title) : null,
        address,
        category: mapCategory(rubricTitles.get(ev.rubricId)) ?? 'sonstiges',
        priceInfo,
        imageUrl: ev.emblemToShow?.url ?? null,
        imageCopyright: ev.emblemCredits ?? null,
        sourceUrl: ev.url,
        externalId: ev.id,
        cancelled: ev.cancelled,
      })
      stats[result]++
    } catch (err) {
      stats.errors.push(`Event ${ev.id}: ${String(err).slice(0, 160)}`)
    }
  }

  return stats
}
