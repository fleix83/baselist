// Cookie-Handling für den Neon-Auth-Proxy.
//
// Der gehostete Dienst setzt "__Secure-neon-auth.*"-Cookies mit
// "Secure; SameSite=None; Partitioned". Chrome verwirft solche Cookies auf
// http://localhost stillschweigend -> Login wirkt wie ein Form-Reset.
// Im lokalen http-Dev schreiben wir die Cookies deshalb um; auf https
// (Vercel) bleibt alles unverändert.

/** Set-Cookie fürs lokale http-Dev browsertauglich machen. */
export function devRewriteSetCookie(setCookie: string): string {
  return setCookie
    .replace(/^__Secure-/i, '')
    .replace(/;\s*Secure/gi, '')
    .replace(/;\s*Partitioned/gi, '')
    .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
}

/**
 * Cookie-Header für Requests an den gehosteten Dienst: im Dev umbenannte
 * "neon-auth.*"-Cookies zurück auf ihre "__Secure-"-Namen mappen.
 * Auf https matcht das Muster nicht (Namen tragen den Präfix bereits).
 */
export function upstreamCookieHeader(cookieHeader: string): string {
  return cookieHeader
    .split(/;\s*/)
    .map((pair) => (/^neon-auth\./i.test(pair) ? `__Secure-${pair}` : pair))
    .join('; ')
}
