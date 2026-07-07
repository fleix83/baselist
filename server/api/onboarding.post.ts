import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getCurrentUser } from '../utils/auth'
import { db, schema } from '../utils/db'
import { normalizeHandle, validateHandle } from '../utils/handles'

const bodySchema = z.object({
  handle: z.string().min(1).max(60),
  displayName: z.string().trim().min(1).max(60),
  interests: z.array(z.enum(['musik', 'nightlife', 'kunst', 'sport', 'talk', 'essen', 'campus', 'sonstiges'])).max(8).default([]),
})

export default defineEventHandler(async (event) => {
  const current = await getCurrentUser(event)
  if (!current) {
    throw createError({ statusCode: 401, statusMessage: 'Nicht eingeloggt' })
  }
  if (current.account) {
    throw createError({ statusCode: 400, statusMessage: 'Onboarding bereits abgeschlossen' })
  }

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Eingaben' })
  }
  const handle = normalizeHandle(parsed.data.handle)
  const handleError = validateHandle(handle)
  if (handleError) {
    throw createError({ statusCode: 400, statusMessage: handleError })
  }

  const existing = await db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(eq(schema.accounts.handle, handle))
    .limit(1)
  if (existing.length > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Dieses Handle ist schon vergeben.' })
  }

  // Admins per Env-Liste (ADMIN_EMAILS, kommagetrennt)
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const isAdmin = adminEmails.includes(current.authUser.email.toLowerCase())

  const accountId = crypto.randomUUID()
  // Neon-HTTP-Treiber: db.batch läuft atomar in einer Transaktion
  await db.batch([
    db.insert(schema.accounts).values({
      id: accountId,
      handle,
      type: 'person',
      displayName: parsed.data.displayName,
    }),
    db.insert(schema.users).values({
      authUserId: current.authUser.id,
      accountId,
      email: current.authUser.email,
      isAdmin,
      interests: parsed.data.interests,
    }),
  ])

  const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, accountId))
  return { account }
})
