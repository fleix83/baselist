import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireUser } from '../utils/auth'
import { db, schema } from '../utils/db'

const bodySchema = z.object({
  body: z.string().trim().max(2000).nullish(),
  imageUrl: z.string().url().max(600).nullish(),
  linkUrl: z.string().url().max(600).nullish(),
  subjectAccountId: z.string().uuid().nullish(),
})

export default defineEventHandler(async (event) => {
  const { account } = await requireUser(event)
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Eingaben' })
  }
  const { body, imageUrl, linkUrl, subjectAccountId } = parsed.data
  if (!body && !imageUrl && !linkUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Der Post braucht Text, Bild oder Link.' })
  }
  if (subjectAccountId) {
    const [subject] = await db
      .select({ id: schema.accounts.id })
      .from(schema.accounts)
      .where(eq(schema.accounts.id, subjectAccountId))
      .limit(1)
    if (!subject) {
      throw createError({ statusCode: 404, statusMessage: 'Bezugskonto nicht gefunden' })
    }
  }

  const [post] = await db
    .insert(schema.posts)
    .values({
      authorAccountId: account.id,
      subjectAccountId: subjectAccountId ?? null,
      body: body ?? null,
      imageUrl: imageUrl ?? null,
      linkUrl: linkUrl ?? null,
      moderationStatus: 'visible',
    })
    .returning()

  return { post }
})
