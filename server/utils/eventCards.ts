// Gemeinsame Event-Karten-Query für Entdecken/Agenda.
import { sql, type SQL } from 'drizzle-orm'
import { db } from './db'

export interface EventCard {
  accountId: string
  handle: string
  title: string
  startsAt: string
  endsAt: string | null
  category: string | null
  priceInfo: string | null
  imageUrl: string | null
  address: string | null
  status: string
  venueName: string | null
  venueHandle: string | null
  goingCount: number
}

/**
 * Sichtbarkeit in Entdecken-Schienen: aggregierte Events (source_id gesetzt) immer;
 * nutzererstellte nur von verifizierten Konten und mit Moderations-OK.
 * Die Schiene "Neu dazugekommen" lockert das auf Moderations-OK (includeUnverified).
 */
export function discoverVisibility(includeUnverified = false): SQL {
  if (includeUnverified) {
    return sql`(e.source_id is not null or e.moderation_status = 'visible')`
  }
  return sql`(
    e.source_id is not null
    or (
      e.moderation_status = 'visible'
      and exists (
        select 1 from accounts c
        where c.id = e.created_by_account_id and c.verified and not c.banned
      )
    )
  )`
}

export async function queryEventCards(where: SQL, orderBy: SQL, limit = 12): Promise<EventCard[]> {
  const result = await db.execute(sql`
    select
      e.account_id as "accountId",
      a.handle,
      a.display_name as "title",
      e.starts_at as "startsAt",
      e.ends_at as "endsAt",
      e.category,
      e.price_info as "priceInfo",
      e.image_url as "imageUrl",
      e.address,
      e.status,
      v.display_name as "venueName",
      v.handle as "venueHandle",
      (select count(*)::int from rsvps r
        where r.event_account_id = e.account_id and r.state = 'going') as "goingCount"
    from events e
    join accounts a on a.id = e.account_id and not a.banned
    left join accounts v on v.id = e.venue_account_id
    where ${where}
    order by ${orderBy}
    limit ${limit}
  `)
  return result.rows as unknown as EventCard[]
}
