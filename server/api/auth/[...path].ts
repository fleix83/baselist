// Proxy zu Neon Auth (gehosteter Better-Auth-Service).
// Macht die Auth-Cookies First-Party und hält das Auth-SDK aus dem Client raus.
// Neben server/utils/auth.ts die einzige Stelle, die mit Neon Auth spricht (Leitplanke 2.2).
export default defineEventHandler(async (event) => {
  const base = process.env.NEON_AUTH_BASE_URL
  if (!base) {
    throw createError({ statusCode: 500, statusMessage: 'NEON_AUTH_BASE_URL ist nicht gesetzt' })
  }
  const target = base.replace(/\/$/, '') + event.path.replace(/^\/api\/auth/, '')

  const method = event.method
  const body = ['GET', 'HEAD'].includes(method) ? undefined : await readRawBody(event, false)

  const headers: Record<string, string> = {}
  for (const name of ['content-type', 'cookie', 'authorization', 'accept', 'user-agent', 'origin', 'referer']) {
    const value = getHeader(event, name)
    if (value) headers[name] = value
  }

  const upstream = await globalThis.fetch(target, {
    method,
    headers,
    body,
    redirect: 'manual',
  })

  // Set-Cookie und Location (OAuth-Redirects) durchreichen
  const setCookies = upstream.headers.getSetCookie?.() ?? []
  for (const cookie of setCookies) {
    appendResponseHeader(event, 'set-cookie', cookie)
  }
  const location = upstream.headers.get('location')
  if (location) {
    setResponseHeader(event, 'location', location)
  }
  setResponseStatus(event, upstream.status)
  setResponseHeader(event, 'content-type', upstream.headers.get('content-type') ?? 'application/json')

  return new Uint8Array(await upstream.arrayBuffer())
})
