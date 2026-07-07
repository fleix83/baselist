// Handle-Regeln: lokal eindeutig, URL-tauglich, keine Imitation von Systempfaden.
export const HANDLE_REGEX = /^[a-z0-9][a-z0-9-]{2,29}$/

export const RESERVED_HANDLES = new Set([
  'admin', 'api', 'auth', 'baselist', 'agenda', 'feed', 'entdecken', 'event',
  'events', 'post', 'posts', 'me', 'profil', 'onboarding', 'impressum',
  'datenschutz', 'regeln', 'einstellungen', 'suche', 'neu', 'hilfe', 'kontakt',
])

export function normalizeHandle(input: string): string {
  return input.trim().toLowerCase().replace(/^@/, '')
}

export function validateHandle(handle: string): string | null {
  if (!HANDLE_REGEX.test(handle)) {
    return 'Handle: 3–30 Zeichen, nur Kleinbuchstaben, Zahlen und Bindestriche, muss mit Buchstabe oder Zahl beginnen.'
  }
  if (RESERVED_HANDLES.has(handle)) {
    return 'Dieses Handle ist reserviert.'
  }
  return null
}

/** Aus einem Titel ein Handle-Kandidat erzeugen (für Event-/Venue-Konten der Aggregation). */
export function slugifyHandle(title: string, maxLength = 30): string {
  const slug = title
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '')
  return slug || 'konto'
}
