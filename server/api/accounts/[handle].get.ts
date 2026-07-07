import { and, count, desc, eq, inArray } from 'drizzle-orm'
import { getCurrentUser } from '../../utils/auth'
import { db, schema } from '../../utils/db'
import { normalizeHandle } from '../../utils/handles'

export default defineEventHandler(async (event) => {
  const handle = normalizeHandle(getRouterParam(event, 'handle') ?? '')
  if (!handle) {
    throw createError({ statusCode: 400, statusMessage: 'Handle fehlt' })
  }

  const [account] = await db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.handle, handle))
    .limit(1)
  if (!account || account.banned) {
    throw createError({ statusCode: 404, statusMessage: 'Konto nicht gefunden' })
  }

  const current = await getCurrentUser(event)
  const isOwn = current?.account?.id === account.id

  // Posts des Kontos (eigene sieht man auch in 'limited'/'held')
  const visibleStates = isOwn ? ['visible', 'limited', 'held'] : ['visible']
  const posts = await db
    .select()
    .from(schema.posts)
    .where(and(
      eq(schema.posts.authorAccountId, account.id),
      inArray(schema.posts.moderationStatus, visibleStates as ('visible' | 'limited' | 'held')[]),
    ))
    .orderBy(desc(schema.posts.createdAt))
    .limit(30)

  const [followerCount] = await db
    .select({ value: count() })
    .from(schema.follows)
    .where(eq(schema.follows.followedAccountId, account.id))
  const [followingCount] = await db
    .select({ value: count() })
    .from(schema.follows)
    .where(eq(schema.follows.followerAccountId, account.id))

  // Event-Erweiterung, falls Konto vom Typ 'event'
  let eventInfo: Record<string, unknown> | null = null
  if (account.type === 'event') {
    const [ev] = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.accountId, account.id))
      .limit(1)
    if (ev) {
      let venue = null
      if (ev.venueAccountId) {
        const [v] = await db
          .select({ handle: schema.accounts.handle, displayName: schema.accounts.displayName })
          .from(schema.accounts)
          .where(eq(schema.accounts.id, ev.venueAccountId))
          .limit(1)
        venue = v ?? null
      }
      let createdBy = null
      if (ev.createdByAccountId) {
        const [c] = await db
          .select({ handle: schema.accounts.handle, displayName: schema.accounts.displayName })
          .from(schema.accounts)
          .where(eq(schema.accounts.id, ev.createdByAccountId))
          .limit(1)
        createdBy = c ?? null
      }
      const [going] = await db
        .select({ value: count() })
        .from(schema.rsvps)
        .where(and(eq(schema.rsvps.eventAccountId, account.id), eq(schema.rsvps.state, 'going')))
      const [saved] = await db
        .select({ value: count() })
        .from(schema.rsvps)
        .where(and(eq(schema.rsvps.eventAccountId, account.id), eq(schema.rsvps.state, 'saved')))
      eventInfo = { ...ev, venue, createdBy, goingCount: going.value, savedCount: saved.value }
    }
  }

  const isFollowing = current?.account
    ? (await db
        .select({ f: schema.follows.followerAccountId })
        .from(schema.follows)
        .where(and(
          eq(schema.follows.followerAccountId, current.account.id),
          eq(schema.follows.followedAccountId, account.id),
        ))
        .limit(1)).length > 0
    : false

  return {
    account,
    event: eventInfo,
    posts,
    followerCount: followerCount.value,
    followingCount: followingCount.value,
    isFollowing,
    isOwn,
  }
})
