import { sql } from 'drizzle-orm'
import { db } from '../utils/db'

export default defineEventHandler(async () => {
  const result = await db.execute(sql`select now() as now, current_database() as db`)
  const row = result.rows[0] as { now: string; db: string }
  return {
    status: 'ok',
    database: row.db,
    time: row.now,
  }
})
