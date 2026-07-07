import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireUser } from '../../utils/auth'
import { db, schema } from '../../utils/db'

const bodySchema = z.object({ accountId: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const { account } = await requireUser(event)
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Eingaben' })
  }
  if (parsed.data.accountId === account.id) {
    throw createError({ statusCode: 400, statusMessage: 'Du kannst dir nicht selbst folgen.' })
  }
  const [target] = await db
    .select({ id: schema.accounts.id, banned: schema.accounts.banned })
    .from(schema.accounts)
    .where(eq(schema.accounts.id, parsed.data.accountId))
    .limit(1)
  if (!target || target.banned) {
    throw createError({ statusCode: 404, statusMessage: 'Konto nicht gefunden' })
  }
  await db
    .insert(schema.follows)
    .values({ followerAccountId: account.id, followedAccountId: target.id })
    .onConflictDoNothing()
  return { ok: true }
})
