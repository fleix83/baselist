// Generischer iCal-Importer: beliebige ICS-Feed-URLs aus sources.config.
import ical from 'node-ical'
import { emptyStats, mapCategory, upsertImportedEvent, type ImportStats } from './core'
import type { EventCategory } from '../../db/schema'
import type { schema } from '../db'

export async function importIcal(source: typeof schema.sources.$inferSelect): Promise<ImportStats> {
  const stats = emptyStats()
  const cfg = source.config as {
    feedUrl?: string
    feedUrls?: string[]
    defaultCategory?: EventCategory
    venueName?: string
  }
  const urls = cfg.feedUrls ?? (cfg.feedUrl ? [cfg.feedUrl] : [])
  if (urls.length === 0) {
    stats.errors.push('Keine feedUrl(s) in sources.config')
    return stats
  }

  for (const url of urls) {
    let parsed: ical.CalendarResponse
    try {
      const res = await globalThis.fetch(url, { headers: { 'user-agent': 'baselist-importer' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      parsed = ical.sync.parseICS(await res.text())
    } catch (err) {
      stats.errors.push(`Feed ${url}: ${String(err).slice(0, 160)}`)
      continue
    }

    for (const item of Object.values(parsed)) {
      if (item.type !== 'VEVENT') continue
      const vevent = item as ical.VEvent
      try {
        if (!vevent.summary || !vevent.start) {
          stats.skipped++
          continue
        }
        // Vergangene Events nicht neu importieren
        if (new Date(vevent.end ?? vevent.start) < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
          stats.skipped++
          continue
        }
        const categories = Array.isArray(vevent.categories)
          ? vevent.categories.join(' ')
          : vevent.categories
        const result = await upsertImportedEvent(source.id, {
          title: String(vevent.summary),
          startsAt: new Date(vevent.start),
          endsAt: vevent.end ? new Date(vevent.end) : null,
          venueName: cfg.venueName ?? null,
          address: vevent.location ? String(vevent.location) : null,
          category: mapCategory(categories) ?? cfg.defaultCategory ?? null,
          sourceUrl: (vevent as { url?: string }).url?.toString() || url,
          externalId: String(vevent.uid ?? `${vevent.summary}-${vevent.start.toISOString()}`),
          cancelled: vevent.status === 'CANCELLED',
        })
        stats[result]++
      } catch (err) {
        stats.errors.push(`VEVENT ${vevent.uid ?? '?'}: ${String(err).slice(0, 160)}`)
      }
    }
  }

  return stats
}
