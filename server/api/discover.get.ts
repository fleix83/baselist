// Entdecken: kuratierte Schienen statt Endlos-Feed.
import { sql, type SQL } from 'drizzle-orm'
import { discoverVisibility, queryEventCards, type EventCard } from '../utils/eventCards'

const CATEGORIES = ['musik', 'nightlife', 'kunst', 'sport', 'talk', 'essen', 'campus', 'sonstiges']

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const rawCategories = typeof query.categories === 'string' ? query.categories.split(',') : []
  const categories = rawCategories.filter((c) => CATEGORIES.includes(c))

  const categoryFilter: SQL = categories.length
    ? sql`and e.category = any(string_to_array(${categories.join(',')}, ','))`
    : sql``
  const active = sql`e.status in ('planned', 'live')`
  const upcoming = sql`e.starts_at >= now()`

  const [today, weekend, free, campus, fresh] = await Promise.all([
    // Heute (Europe/Zurich-Tagesgrenze)
    queryEventCards(
      sql`${active} ${categoryFilter}
        and (e.starts_at at time zone 'Europe/Zurich')::date = (now() at time zone 'Europe/Zurich')::date
        and ${discoverVisibility()}`,
      sql`e.starts_at asc`,
    ),
    // Dieses Wochenende (Fr–So innerhalb der nächsten 7 Tage)
    queryEventCards(
      sql`${active} and ${upcoming} ${categoryFilter}
        and e.starts_at < now() + interval '7 days'
        and extract(isodow from e.starts_at at time zone 'Europe/Zurich') in (5, 6, 7)
        and ${discoverVisibility()}`,
      sql`e.starts_at asc`,
    ),
    // Gratis
    queryEventCards(
      sql`${active} and ${upcoming} ${categoryFilter}
        and (e.price_info ilike '%gratis%' or e.price_info ilike '%kostenlos%' or e.price_info ilike '%kollekte%' or e.price_info ilike '%eintritt frei%')
        and ${discoverVisibility()}`,
      sql`e.starts_at asc`,
    ),
    // Beim Campus
    queryEventCards(
      sql`${active} and ${upcoming}
        and e.category = 'campus'
        and ${discoverVisibility()}`,
      sql`e.starts_at asc`,
    ),
    // Neu dazugekommen (nach Konto-Erstellung; nutzererstellte nach Moderations-OK)
    queryEventCards(
      sql`${active} and ${upcoming} ${categoryFilter}
        and ${discoverVisibility(true)}`,
      sql`a.created_at desc, e.starts_at asc`,
    ),
  ])

  const rails: { key: string; title: string; events: EventCard[] }[] = [
    { key: 'heute', title: 'Heute', events: today },
    { key: 'wochenende', title: 'Dieses Wochenende', events: weekend },
    { key: 'gratis', title: 'Gratis', events: free },
    { key: 'campus', title: 'Beim Campus', events: campus },
    { key: 'neu', title: 'Neu dazugekommen', events: fresh },
  ]

  return { rails: rails.filter((r) => r.events.length > 0) }
})
