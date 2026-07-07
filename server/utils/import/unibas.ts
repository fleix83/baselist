// Uni-Basel-Importer: Der Veranstaltungskalender bietet keinen Gesamt-ICS-Feed,
// aber einen RSS-Feed plus Per-Event-ICS unter /.rest/export/v1/ical/{uuid}.ics.
// RSS liefert die Event-Liste, das ICS die sauberen Zeiten (Europe/Zurich).
import ical from 'node-ical'
import { emptyStats, mapCategory, upsertImportedEvent, type ImportStats } from './core'
import type { EventCategory } from '../../db/schema'
import type { schema } from '../db'

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+)uml;/gi, (_, c) => ({ a: 'ä', o: 'ö', u: 'ü', A: 'Ä', O: 'Ö', U: 'Ü' })[c as string] ?? c)
}

function tag(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return match ? decodeEntities(match[1].trim()) : null
}

export async function importUnibas(source: typeof schema.sources.$inferSelect): Promise<ImportStats> {
  const stats = emptyStats()
  const cfg = source.config as {
    rssUrl?: string
    icalPattern?: string
    defaultCategory?: EventCategory
  }
  if (!cfg.rssUrl || !cfg.icalPattern) {
    stats.errors.push('rssUrl/icalPattern fehlen in sources.config')
    return stats
  }

  let xml: string
  try {
    const res = await globalThis.fetch(cfg.rssUrl, { headers: { 'user-agent': 'baselist-importer' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    xml = await res.text()
  } catch (err) {
    stats.errors.push(`RSS: ${String(err).slice(0, 160)}`)
    return stats
  }

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1])
  for (const item of items) {
    try {
      const link = tag(item, 'link')
      const rawTitle = tag(item, 'title') ?? ''
      const uuid = link?.match(/[?&]id=([0-9a-f-]{36})/i)?.[1]
      if (!link || !uuid) {
        stats.skipped++
        continue
      }

      // Titel im RSS trägt ein Datums-Präfix "DD.MM.YYYY HH:MM [- DD.MM.YYYY HH:MM] Titel"
      const title = rawTitle
        .replace(/^\d{2}\.\d{2}\.\d{4}(?: \d{2}:\d{2})?(?: ?- ?\d{2}\.\d{2}\.\d{4}(?: \d{2}:\d{2})?)? */, '')
        .trim() || rawTitle

      // Per-Event-ICS liefert die verlässlichen Zeiten
      const icsUrl = cfg.icalPattern.replace('{id}', uuid)
      const res = await globalThis.fetch(icsUrl, { headers: { 'user-agent': 'baselist-importer' } })
      if (!res.ok) {
        stats.errors.push(`ICS ${uuid}: HTTP ${res.status}`)
        continue
      }
      const parsed = ical.sync.parseICS(await res.text())
      const vevent = Object.values(parsed).find((entry) => entry.type === 'VEVENT') as ical.VEvent | undefined
      if (!vevent?.start) {
        stats.skipped++
        continue
      }

      // Nur der Titel ist verlässlich; die RSS-Description mischt Teaser,
      // Organisation und Ort und führt zu Fehlkategorien.
      const result = await upsertImportedEvent(source.id, {
        title,
        startsAt: new Date(vevent.start),
        endsAt: vevent.end ? new Date(vevent.end) : null,
        address: vevent.location ? String(vevent.location) : null,
        category: mapCategory(title) ?? cfg.defaultCategory ?? 'campus',
        priceInfo: null,
        sourceUrl: link,
        externalId: uuid,
      })
      stats[result]++
    } catch (err) {
      stats.errors.push(`Item: ${String(err).slice(0, 160)}`)
    }
  }

  return stats
}
