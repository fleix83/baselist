// Einfache konfigurierbare Sperrwortliste. Treffer setzen Inhalte auf 'held'
// (Prüfung durch Admin). Erweiterbar hier oder per Env BLOCKWORDS
// (kommagetrennt, wird zusätzlich geladen).
const DEFAULT_BLOCKWORDS = [
  'sieg heil',
  'heil hitler',
  'weisse macht',
  'white power',
  'gaskammer dich',
  'vergas',
]

export function getBlockwords(): string[] {
  const extra = (process.env.BLOCKWORDS ?? '')
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)
  return [...DEFAULT_BLOCKWORDS, ...extra]
}

export function findBlockedWord(text: string): string | null {
  const lowered = text.toLowerCase()
  for (const word of getBlockwords()) {
    if (lowered.includes(word)) return word
  }
  return null
}
