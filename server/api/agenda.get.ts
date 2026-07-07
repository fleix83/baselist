// Agenda: eigene gespeicherte/zugesagte Events, sortiert nach Eventdatum.
import { sql } from 'drizzle-orm'
import { requireUser } from '../utils/auth'
import { db } from '../utils/db'

export default defineEventHandler(async (event) => {
  const { account } = await requireUser(event)

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
      r.state,
      (select count(*)::int from rsvps rr
        where rr.event_account_id = e.account_id and rr.state = 'going') as "goingCount"
    from rsvps r
    join events e on e.account_id = r.event_account_id
    join accounts a on a.id = e.account_id
    left join accounts v on v.id = e.venue_account_id
    where r.user_account_id = ${account.id}
      and e.status != 'cancelled'
      and coalesce(e.ends_at, e.starts_at + interval '4 hours') >= now()
    order by e.starts_at asc
    limit 100
  `)

  return { events: result.rows }
})
