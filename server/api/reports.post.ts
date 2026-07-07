import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireUser } from '../utils/auth'
import { db, schema } from '../utils/db'
import { enforceRateLimit, logModeration } from '../utils/moderation'

const bodySchema = z.object({
  targetKind: z.enum(['post', 'event', 'account']),
  targetId: z.string().uuid(),
  reason: z.enum(['spam', 'hate', 'illegal', 'fake_event', 'other']),
  note: z.string().trim().max(500).nullish(),
})

export default defineEventHandler(async (event) => {
  const { account } = await requireUser(event)
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Eingaben' })
  }
  const { targetKind, targetId, reason, note } = parsed.data

  await enforceRateLimit(account, 'report')

  // Doppelmeldungen desselben Kontos auf dasselbe Ziel verhindern
  const [existing] = await db
    .select({ id: schema.reports.id })
    .from(schema.reports)
    .where(and(
      eq(schema.reports.reporterAccountId, account.id),
      eq(schema.reports.targetKind, targetKind),
      eq(schema.reports.targetId, targetId),
      eq(schema.reports.status, 'open'),
    ))
    .limit(1)
  if (existing) {
    return { ok: true, alreadyReported: true }
  }

  await db.insert(schema.reports).values({
    reporterAccountId: account.id,
    targetKind,
    targetId,
    reason,
    note: note ?? null,
    status: 'open',
  })

  // Ab 3 unabhängigen offenen Reports automatisch 'limited' bis zur Sichtung
  const result = await db.execute(sql`
    select count(distinct reporter_account_id) as reporters
    from reports
    where target_kind = ${targetKind} and target_id = ${targetId}
      and status = 'open' and reporter_account_id is not null
  `)
  const reporters = Number((result.rows[0] as { reporters: string }).reporters)
  if (reporters >= 3 && (targetKind === 'post' || targetKind === 'event')) {
    const table = targetKind === 'post' ? schema.posts : schema.events
    const idColumn = targetKind === 'post' ? schema.posts.id : schema.events.accountId
    await db
      .update(table)
      .set({ moderationStatus: 'limited' })
      .where(and(eq(idColumn, targetId), eq(table.moderationStatus, 'visible')))
    await logModeration('system', 'auto_limited_nach_3_reports', targetKind, targetId)
  }

  return { ok: true }
})
