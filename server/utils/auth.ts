// Auth-Abstraktion (Leitplanke 2.2): Sämtlicher Auth-Zugriff läuft über diese Datei.
// Beim Wechsel zu Supabase Auth sind nur diese Datei und der Proxy
// server/api/auth/[...path].ts betroffen.
import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { upstreamCookieHeader } from './authCookies'
import { db, schema } from './db'

export interface AuthUser {
  id: string
  email: string
  name?: string | null
  emailVerified?: boolean
}

export interface CurrentUser {
  authUser: AuthUser
  /** Zeile aus unserer users-Tabelle; null solange Onboarding nicht abgeschlossen */
  user: typeof schema.users.$inferSelect | null
  /** Personen-Konto; null solange Onboarding nicht abgeschlossen */
  account: typeof schema.accounts.$inferSelect | null
}

/** Session beim gehosteten Auth-Service nachschlagen (Cookie wird durchgereicht). */
async function fetchAuthUser(event: H3Event): Promise<AuthUser | null> {
  const base = process.env.NEON_AUTH_BASE_URL
  const cookie = getHeader(event, 'cookie')
  if (!base || !cookie) return null
  try {
    const res = await $fetch<{ user: AuthUser | null } | null>(`${base}/get-session`, {
      headers: { cookie: upstreamCookieHeader(cookie) },
    })
    return res?.user ?? null
  } catch {
    return null
  }
}

/** Aktuellen Nutzer inkl. Konto laden; pro Request gecacht. null = nicht eingeloggt. */
export async function getCurrentUser(event: H3Event): Promise<CurrentUser | null> {
  if (event.context._currentUser !== undefined) {
    return event.context._currentUser as CurrentUser | null
  }
  let result: CurrentUser | null = null
  const authUser = await fetchAuthUser(event)
  if (authUser) {
    const rows = await db
      .select()
      .from(schema.users)
      .leftJoin(schema.accounts, eq(schema.users.accountId, schema.accounts.id))
      .where(eq(schema.users.authUserId, authUser.id))
      .limit(1)
    result = {
      authUser,
      user: rows[0]?.users ?? null,
      account: rows[0]?.accounts ?? null,
    }
  }
  event.context._currentUser = result
  return result
}

/** Eingeloggter Nutzer mit abgeschlossenem Onboarding, sonst 401/403. */
export async function requireUser(event: H3Event): Promise<CurrentUser & {
  user: typeof schema.users.$inferSelect
  account: typeof schema.accounts.$inferSelect
}> {
  const current = await getCurrentUser(event)
  if (!current) {
    throw createError({ statusCode: 401, statusMessage: 'Nicht eingeloggt' })
  }
  if (!current.user || !current.account) {
    throw createError({ statusCode: 403, statusMessage: 'Onboarding nicht abgeschlossen', data: { code: 'ONBOARDING_REQUIRED' } })
  }
  if (current.account.banned) {
    throw createError({ statusCode: 403, statusMessage: 'Konto gesperrt' })
  }
  return current as Awaited<ReturnType<typeof requireUser>>
}

/** Wie requireUser, zusätzlich is_admin erforderlich. */
export async function requireAdmin(event: H3Event) {
  const current = await requireUser(event)
  if (!current.user.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Nur für Admins' })
  }
  return current
}
