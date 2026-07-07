// Zentraler DB-Client (Leitplanke 2.1): Der spätere Wechsel Neon -> Supabase
// betrifft nur diese Datei (Treiber/Connection-String tauschen).
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../db/schema'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL ist nicht gesetzt')
}

const sql = neon(databaseUrl)

export const db = drizzle(sql, { schema })
export { schema }
