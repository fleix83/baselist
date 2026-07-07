import { and, eq } from 'drizzle-orm'
import { requireUser } from '../../utils/auth'
import { db, schema } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const { account } = await requireUser(event)
  const accountId = getRouterParam(event, 'accountId') ?? ''
  await db
    .delete(schema.follows)
    .where(and(
      eq(schema.follows.followerAccountId, account.id),
      eq(schema.follows.followedAccountId, accountId),
    ))
  return { ok: true }
})
