import { and, eq } from 'drizzle-orm'
import { requireUser } from '../../../utils/auth'
import { db, schema } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const { account } = await requireUser(event)
  const eventId = getRouterParam(event, 'id') ?? ''
  await db
    .delete(schema.rsvps)
    .where(and(
      eq(schema.rsvps.userAccountId, account.id),
      eq(schema.rsvps.eventAccountId, eventId),
    ))
  return { ok: true, state: null }
})
