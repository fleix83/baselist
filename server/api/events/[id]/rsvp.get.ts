import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '../../../utils/auth'
import { db, schema } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const current = await getCurrentUser(event)
  if (!current?.account) return { state: null }
  const eventId = getRouterParam(event, 'id') ?? ''
  const [row] = await db
    .select({ state: schema.rsvps.state })
    .from(schema.rsvps)
    .where(and(
      eq(schema.rsvps.userAccountId, current.account.id),
      eq(schema.rsvps.eventAccountId, eventId),
    ))
    .limit(1)
  return { state: row?.state ?? null }
})
