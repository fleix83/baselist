import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireUser } from '../../utils/auth'
import { db, schema } from '../../utils/db'
import { ensureUniqueHandle } from '../../utils/import/core'
import { slugifyHandle } from '../../utils/handles'
import { enforceRateLimit, fileSystemReport, runModerationChain } from '../../utils/moderation'

const bodySchema = z.object({
  title: z.string().trim().min(3).max(120),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullish(),
  address: z.string().trim().max(200).nullish(),
  venueAccountId: z.string().uuid().nullish(),
  category: z.enum(['musik', 'nightlife', 'kunst', 'sport', 'talk', 'essen', 'campus', 'sonstiges']),
  priceInfo: z.string().trim().max(100).nullish(),
  description: z.string().trim().max(3000).nullish(),
  imageUrl: z.string().url().max(600).nullish(),
})

export default defineEventHandler(async (event) => {
  const { account } = await requireUser(event)
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Eingaben' })
  }
  const data = parsed.data
  if (data.startsAt < new Date(Date.now() - 60 * 60 * 1000)) {
    throw createError({ statusCode: 400, statusMessage: 'Der Start liegt in der Vergangenheit.' })
  }
  if (data.endsAt && data.endsAt <= data.startsAt) {
    throw createError({ statusCode: 400, statusMessage: 'Das Ende muss nach dem Start liegen.' })
  }

  // Venue nur verlinken, nie imitieren: Referenz muss ein Venue-Konto sein
  if (data.venueAccountId) {
    const [venue] = await db
      .select({ id: schema.accounts.id, type: schema.accounts.type })
      .from(schema.accounts)
      .where(eq(schema.accounts.id, data.venueAccountId))
      .limit(1)
    if (!venue || venue.type !== 'venue') {
      throw createError({ statusCode: 400, statusMessage: 'Ungültige Venue' })
    }
  }

  // Moderationskette: Rate-Limit -> Sperrwortliste -> AI-Check
  await enforceRateLimit(account, 'event')
  const outcome = await runModerationChain([data.title, data.description].filter(Boolean).join('\n'))

  const accountId = crypto.randomUUID()
  const handle = await ensureUniqueHandle(slugifyHandle(data.title, 40))
  const dateLabel = new Intl.DateTimeFormat('de-CH', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich',
  }).format(data.startsAt)

  await db.batch([
    db.insert(schema.accounts).values({
      id: accountId,
      handle,
      type: 'event',
      displayName: data.title,
      trustLevel: account.trustLevel,
    }),
    db.insert(schema.events).values({
      accountId,
      startsAt: data.startsAt,
      endsAt: data.endsAt ?? null,
      venueAccountId: data.venueAccountId ?? null,
      address: data.address ?? null,
      category: data.category,
      priceInfo: data.priceInfo ?? null,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      status: 'planned',
      moderationStatus: outcome.status,
      createdByAccountId: account.id,
    }),
    // Ankündigungs-Post: so erscheint das Event im Folge-Feed der Follower,
    // der Ersteller bleibt als Autor sichtbar. Erbt den Moderationsstatus.
    db.insert(schema.posts).values({
      authorAccountId: account.id,
      subjectAccountId: accountId,
      body: `Neues Event: ${data.title} – ${dateLabel}`,
      moderationStatus: outcome.status,
    }),
  ])

  if (outcome.queue) {
    await fileSystemReport('event', accountId, outcome.queue.reason, outcome.queue.note)
  }

  const [created] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, accountId))
  return { account: created }
})
