// Venue-Liste für die Venue-Verlinkung beim Event-Erstellen.
import { asc, eq } from 'drizzle-orm'
import { db, schema } from '../utils/db'

export default defineEventHandler(async () => {
  const venues = await db
    .select({
      id: schema.accounts.id,
      handle: schema.accounts.handle,
      displayName: schema.accounts.displayName,
    })
    .from(schema.accounts)
    .where(eq(schema.accounts.type, 'venue'))
    .orderBy(asc(schema.accounts.displayName))
    .limit(500)
  return { venues }
})
