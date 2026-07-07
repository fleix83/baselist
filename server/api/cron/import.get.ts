// Aggregations-Lauf, ausgelöst durch Vercel Cron (alle 6 Stunden, siehe vercel.json).
// Vercel sendet automatisch "Authorization: Bearer $CRON_SECRET";
// manuell geht auch der Header "x-cron-secret".
import { eq } from 'drizzle-orm'
import { db, schema } from '../../utils/db'
import { markPastEvents, type ImportStats } from '../../utils/import/core'
import { importEventfrog } from '../../utils/import/eventfrog'
import { importIcal } from '../../utils/import/ical'
import { importUnibas } from '../../utils/import/unibas'

export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  const bearer = getHeader(event, 'authorization')
  const headerSecret = getHeader(event, 'x-cron-secret')
  if (!secret || (bearer !== `Bearer ${secret}` && headerSecret !== secret)) {
    throw createError({ statusCode: 401, statusMessage: 'Ungültiges Cron-Secret' })
  }

  const enabledSources = await db
    .select()
    .from(schema.sources)
    .where(eq(schema.sources.enabled, true))

  const importers = {
    eventfrog: importEventfrog,
    ical: importIcal,
    unibas: importUnibas,
  } as const

  const results: Record<string, ImportStats | { error: string }> = {}
  for (const source of enabledSources) {
    const importer = importers[source.kind]
    if (!importer) {
      results[source.name] = { error: `Unbekannte Quelle: ${source.kind}` }
      continue
    }
    try {
      const stats = await importer(source)
      results[source.name] = stats
      await db
        .update(schema.sources)
        .set({
          lastRunAt: new Date(),
          lastStatus: stats.errors.length
            ? `ok mit ${stats.errors.length} Fehlern: +${stats.created} ~${stats.updated}`
            : `ok: +${stats.created} ~${stats.updated} (${stats.skipped} übersprungen)`,
        })
        .where(eq(schema.sources.id, source.id))
    } catch (err) {
      const message = String(err).slice(0, 300)
      results[source.name] = { error: message }
      await db
        .update(schema.sources)
        .set({ lastRunAt: new Date(), lastStatus: `error: ${message.slice(0, 180)}` })
        .where(eq(schema.sources.id, source.id))
    }
  }

  await markPastEvents()

  console.log('[cron/import]', JSON.stringify(results))
  return { ranAt: new Date().toISOString(), results }
})
