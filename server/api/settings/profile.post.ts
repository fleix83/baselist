import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireUser } from '../../utils/auth'
import { db, schema } from '../../utils/db'

const bodySchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(500).nullish(),
  avatarUrl: z.string().url().max(500).nullish(),
})

export default defineEventHandler(async (event) => {
  const { account } = await requireUser(event)
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Eingaben' })
  }
  const [updated] = await db
    .update(schema.accounts)
    .set({
      displayName: parsed.data.displayName,
      bio: parsed.data.bio ?? null,
      ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl } : {}),
    })
    .where(eq(schema.accounts.id, account.id))
    .returning()
  return { account: updated }
})
