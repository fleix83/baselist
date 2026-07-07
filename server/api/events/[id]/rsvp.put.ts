import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireUser } from '../../../utils/auth'
import { db, schema } from '../../../utils/db'

const bodySchema = z.object({ state: z.enum(['saved', 'going']) })

export default defineEventHandler(async (event) => {
  const { account } = await requireUser(event)
  const eventId = getRouterParam(event, 'id') ?? ''
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültiger Zustand' })
  }
  const [target] = await db
    .select({ id: schema.events.accountId })
    .from(schema.events)
    .where(eq(schema.events.accountId, eventId))
    .limit(1)
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Event nicht gefunden' })
  }
  await db
    .insert(schema.rsvps)
    .values({ userAccountId: account.id, eventAccountId: eventId, state: parsed.data.state })
    .onConflictDoUpdate({
      target: [schema.rsvps.userAccountId, schema.rsvps.eventAccountId],
      set: { state: parsed.data.state, createdAt: new Date() },
    })
  return { ok: true, state: parsed.data.state }
})
