// Zentrale Moderations-Utilities: Rate-Limits, Sperrwortliste, AI-Check
// (Infomaniak AI Tools, OpenAI-kompatibel), Mapping auf moderation_status.
import { sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { db, schema } from './db'
import { findBlockedWord } from './blockwords'

// --- Rate-Limits -----------------------------------------------------------

// Limits pro Stunde nach trust_level (0 = neu). Zentral, damit Anpassungen
// an einer Stelle passieren.
const RATE_LIMITS: Record<string, (trustLevel: number) => number> = {
  post: (t) => (t >= 3 ? 60 : t >= 1 ? 15 : 5),
  event: (t) => (t >= 3 ? 20 : t >= 1 ? 5 : 2),
  report: () => 10,
}

/** Wirft 429, wenn das Stundenlimit für die Aktion erreicht ist. */
export async function enforceRateLimit(
  account: { id: string; trustLevel: number },
  action: keyof typeof RATE_LIMITS,
): Promise<void> {
  const limit = RATE_LIMITS[action](account.trustLevel)
  const windowStart = new Date()
  windowStart.setMinutes(0, 0, 0)

  const result = await db.execute(sql`
    insert into rate_limits (account_id, action, window_start, count)
    values (${account.id}, ${action}, ${windowStart.toISOString()}, 1)
    on conflict (account_id, action, window_start)
    do update set count = rate_limits.count + 1
    returning count
  `)
  const count = Number((result.rows[0] as { count: number }).count)
  if (count > limit) {
    throw createError({
      statusCode: 429,
      statusMessage: `Limit erreicht: höchstens ${limit}× pro Stunde. Versuch es später nochmal.`,
    })
  }
}

// --- AI-Check (Infomaniak) ---------------------------------------------------

export interface ModerationVerdict {
  severity: 'ok' | 'unsure' | 'severe'
  categories: string[]
}

const SYSTEM_PROMPT = `Du bist ein Moderations-Prüfer für eine lokale Social-Plattform in Basel (Deutsch).
Bewerte den Nutzerinhalt. Antworte NUR mit JSON, exakt in diesem Format:
{"severity":"ok"|"unsure"|"severe","categories":[...]}
Kategorien (nur zutreffende): hate, harassment, sexual, violence, illegal, spam.
"severe": klar verletzend/illegal (Hassrede, Gewaltaufrufe, Illegales).
"unsure": grenzwertig oder nicht sicher einschätzbar.
"ok": unbedenklich. Normale Event-Ankündigungen, Meinungen und Umgangssprache sind ok.`

/**
 * moderateContent(text): ruft Infomaniak (OpenAI-kompatibel).
 * Rückgabe null = API-Fehler (Aufrufer entscheidet Fail-open),
 * 'unconfigured' = Keys fehlen (kein Queue-Spam, nur Log).
 */
export async function moderateContent(
  text: string,
): Promise<ModerationVerdict | null | 'unconfigured'> {
  const token = process.env.INFOMANIAK_API_TOKEN
  const productId = process.env.INFOMANIAK_PRODUCT_ID
  const model = process.env.INFOMANIAK_MODEL || 'mistralai/Mistral-Small-4-119B-2603'
  if (!token || !productId) {
    console.warn('[moderation] INFOMANIAK_API_TOKEN/PRODUCT_ID fehlen – AI-Check inaktiv')
    return 'unconfigured'
  }
  try {
    const res = await globalThis.fetch(
      `https://api.infomaniak.com/2/ai/${productId}/openai/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(12_000),
        body: JSON.stringify({
          model,
          stream: false, // Infomaniak streamt per Default!
          temperature: 0,
          max_completion_tokens: 200,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'moderation',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  severity: { type: 'string', enum: ['ok', 'unsure', 'severe'] },
                  categories: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: ['hate', 'harassment', 'sexual', 'violence', 'illegal', 'spam'],
                    },
                  },
                },
                required: ['severity', 'categories'],
                additionalProperties: false,
              },
            },
          },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: text.slice(0, 4000) },
          ],
        }),
      },
    )
    if (!res.ok) {
      console.error(`[moderation] Infomaniak HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return null
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content
    if (!content) return null
    const verdict = JSON.parse(content) as ModerationVerdict
    if (!['ok', 'unsure', 'severe'].includes(verdict.severity)) return null
    return { severity: verdict.severity, categories: verdict.categories ?? [] }
  } catch (err) {
    console.error('[moderation] AI-Check fehlgeschlagen:', String(err).slice(0, 200))
    return null
  }
}

// --- Moderationskette --------------------------------------------------------

export interface ModerationOutcome {
  status: 'visible' | 'limited' | 'held'
  queue: { reason: 'spam' | 'hate' | 'illegal' | 'fake_event' | 'other'; note: string } | null
}

function reasonFromCategories(categories: string[]): 'spam' | 'hate' | 'illegal' | 'other' {
  if (categories.includes('hate') || categories.includes('harassment') || categories.includes('violence')) return 'hate'
  if (categories.includes('illegal')) return 'illegal'
  if (categories.includes('spam')) return 'spam'
  return 'other'
}

/**
 * Kette: Sperrwortliste -> AI-Check.
 * ok -> visible; unsure -> limited + Queue; severe -> held + Queue;
 * API-Fehler -> visible + Queue (Fail-open mit Sichtung).
 */
export async function runModerationChain(text: string): Promise<ModerationOutcome> {
  const trimmed = text.trim()
  if (!trimmed) return { status: 'visible', queue: null }

  const blocked = findBlockedWord(trimmed)
  if (blocked) {
    return {
      status: 'held',
      queue: { reason: 'other', note: `Sperrwort-Treffer: "${blocked}"` },
    }
  }

  const verdict = await moderateContent(trimmed)
  if (verdict === 'unconfigured') {
    return { status: 'visible', queue: null }
  }
  if (verdict === null) {
    return {
      status: 'visible',
      queue: { reason: 'other', note: 'AI-Check fehlgeschlagen (Fail-open) – bitte sichten' },
    }
  }
  if (verdict.severity === 'severe') {
    // Benachrichtigung: Log reicht fürs MVP (Sentry/E-Mail später)
    console.error('[moderation] SEVERE Inhalt gehalten:', verdict.categories.join(','), trimmed.slice(0, 120))
    return {
      status: 'held',
      queue: { reason: reasonFromCategories(verdict.categories), note: `AI: severe (${verdict.categories.join(', ')})` },
    }
  }
  if (verdict.severity === 'unsure') {
    return {
      status: 'limited',
      queue: { reason: reasonFromCategories(verdict.categories), note: `AI: unsure (${verdict.categories.join(', ')})` },
    }
  }
  return { status: 'visible', queue: null }
}

/** System-Report in die Queue legen (reporter = null = System). */
export async function fileSystemReport(
  targetKind: 'post' | 'event' | 'account',
  targetId: string,
  reason: NonNullable<ModerationOutcome['queue']>['reason'],
  note: string,
): Promise<void> {
  await db.insert(schema.reports).values({
    reporterAccountId: null,
    targetKind,
    targetId,
    reason,
    note,
    status: 'open',
  })
}

/** Moderations-Log-Eintrag. */
export async function logModeration(
  actor: string,
  action: string,
  targetKind: string,
  targetId: string,
  note?: string | null,
): Promise<void> {
  await db.insert(schema.moderationLog).values({
    actor,
    action,
    targetKind,
    targetId,
    note: note ?? null,
  })
}

/** Für Endpoints: bequemer Zugriff auf die Kette inkl. Queue-Eintrag. */
export async function moderateAndFile(
  event: H3Event,
  text: string,
  targetKind: 'post' | 'event',
  insert: (status: ModerationOutcome['status']) => Promise<string>,
): Promise<{ id: string; status: ModerationOutcome['status'] }> {
  const outcome = await runModerationChain(text)
  const id = await insert(outcome.status)
  if (outcome.queue) {
    await fileSystemReport(targetKind, id, outcome.queue.reason, outcome.queue.note)
  }
  return { id, status: outcome.status }
}
