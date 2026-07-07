// Admin-Aktionen: freigeben, entfernen, Reichweite begrenzen,
// Konto verwarnen/sperren. Jede Aktion landet im moderation_log.
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmin } from '../../utils/auth'
import { db, schema } from '../../utils/db'
import { logModeration } from '../../utils/moderation'

const bodySchema = z.object({
  targetKind: z.enum(['post', 'event', 'account']),
  targetId: z.string().uuid(),
  action: z.enum(['approve', 'limit', 'remove', 'warn', 'ban', 'unban']),
  note: z.string().trim().max(500).nullish(),
})

export default defineEventHandler(async (event) => {
  const { account: admin } = await requireAdmin(event)
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Eingaben' })
  }
  const { targetKind, targetId, action, note } = parsed.data

  const statusByAction: Record<string, 'visible' | 'limited' | 'removed'> = {
    approve: 'visible',
    limit: 'limited',
    remove: 'removed',
  }

  if (action in statusByAction) {
    if (targetKind === 'post') {
      await db.update(schema.posts)
        .set({ moderationStatus: statusByAction[action] })
        .where(eq(schema.posts.id, targetId))
    } else if (targetKind === 'event') {
      await db.update(schema.events)
        .set({ moderationStatus: statusByAction[action] })
        .where(eq(schema.events.accountId, targetId))
    } else {
      throw createError({ statusCode: 400, statusMessage: 'Diese Aktion gilt nur für Posts/Events.' })
    }
  } else if (action === 'ban' || action === 'unban') {
    // Bei Post/Event-Zielen wird das Autor-/Ersteller-Konto gesperrt
    let accountId = targetId
    if (targetKind === 'post') {
      const [post] = await db.select({ author: schema.posts.authorAccountId })
        .from(schema.posts).where(eq(schema.posts.id, targetId)).limit(1)
      if (!post) throw createError({ statusCode: 404, statusMessage: 'Post nicht gefunden' })
      accountId = post.author
    } else if (targetKind === 'event') {
      const [ev] = await db.select({ creator: schema.events.createdByAccountId })
        .from(schema.events).where(eq(schema.events.accountId, targetId)).limit(1)
      if (!ev?.creator) throw createError({ statusCode: 404, statusMessage: 'Kein Ersteller-Konto gefunden' })
      accountId = ev.creator
    }
    await db.update(schema.accounts)
      .set({ banned: action === 'ban' })
      .where(eq(schema.accounts.id, accountId))
  }
  // 'warn' hat keine Datenänderung ausser Log (E-Mail-Versand später)

  // Offene Reports zum Ziel schliessen
  await db.update(schema.reports)
    .set({ status: 'resolved' })
    .where(and(
      eq(schema.reports.targetKind, targetKind),
      eq(schema.reports.targetId, targetId),
      eq(schema.reports.status, 'open'),
    ))

  await logModeration(`@${admin.handle}`, action, targetKind, targetId, note)

  return { ok: true }
})
